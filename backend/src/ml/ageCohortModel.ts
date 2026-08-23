/**
 * Small trained neural network scoring how "balanced" a site combination's
 * aggregate patient age-cohort mix is (0-100, higher = more balanced), plus
 * model-derived explainability for that score.
 *
 * WHY THIS FILE EXISTS: Srikanth's explicit requirement (see
 * pipeline/siteCombinationOptimizer.ts's header) was for "a real AI/
 * deep-learning approach, not just heuristic or statistical models" to
 * assess risk by age cohort, because he said simple statistical models
 * "max out" on this problem. This is a genuine small multilayer neural
 * network — real forward and backward passes, real learned weights — not a
 * formula or lookup table relabeled as one.
 *
 * HONEST LIMITATION (read before presenting this as more than it is):
 * there is no real historical dataset anywhere in this app, or known to be
 * publicly available, linking a clinical trial's actual patient age-cohort
 * composition to its actual enrollment/completion outcome. So this network
 * is trained on SYNTHETIC labels generated from a stated HYPOTHESIS (see
 * syntheticGroundTruthScore below): an even split across the four bands
 * scores best, and a combination skewed heavily toward the 50-65 band is
 * specifically penalized — encoding the exact intuition Srikanth described
 * in the 2024 demo ("too many patients aged 50-65 vs. a better-balanced mix
 * across 20-30/30-40/40-50"). The network's weights are real and were
 * genuinely learned by gradient descent, but what they were trained to
 * approximate is a modeled hypothesis, not observed real-world outcomes.
 * If the organization ever obtains real historical enrollment/outcome data
 * broken down by age cohort, swapping `buildTrainingSet` for that real data
 * (keeping everything else in this file the same) turns this into a
 * genuinely evidence-trained model with no other code changes needed.
 *
 * Deterministic: the synthetic training set and the initial weights are
 * both generated from a seeded PRNG, so training always converges to the
 * same weights on every process start — same determinism convention used
 * throughout this codebase (see data/syntheticPopulation.ts).
 */

export interface AgeMix {
  p2030: number; // fraction 0-1
  p3040: number;
  p4050: number;
  p5065: number;
}

export const AGE_COHORT_MODEL_DISCLOSURE =
  "Age-Cohort Balance is scored by a small trained neural network (2 hidden " +
  "layers, gradient-descent trained), not a lookup table or plain formula. " +
  "It is trained on SYNTHETIC outcome labels generated from a stated " +
  "hypothesis — even age-cohort splits score best, heavy 50-65 " +
  "concentration is penalized — because no real historical dataset linking " +
  "trial outcomes to age-cohort mix exists in this app or is known to be " +
  "publicly available. Treat the score as a demo-grade illustration of the " +
  "concept, not a validated clinical prediction.";

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — same algorithm used elsewhere in this codebase.
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-9);
  const u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Training-data composition sampler — deliberately varied (not real
 * population statistics; this generates synthetic input mixes to train
 * against, using a simple sum-of-exponentials Dirichlet-ish approximation
 * that's adequate for producing a spread of plausible 4-way splits).
 */
function sampleMix(rand: () => number): number[] {
  const alphas = [2, 2, 2, 2];
  const draws = alphas.map((a) => {
    let sum = 0;
    for (let i = 0; i < a; i++) sum += -Math.log(Math.max(rand(), 1e-9));
    return sum;
  });
  const total = draws.reduce((a, b) => a + b, 0);
  return draws.map((d) => d / total);
}

/**
 * The stated hypothesis this model is trained to approximate — see the
 * file-level HONEST LIMITATION comment. NOT a validated real-world formula.
 */
function syntheticGroundTruthScore(mix: number[], rand: () => number): number {
  const [p1, p2, p3, p4] = mix;
  const ideal = 0.25;
  const imbalance =
    (Math.abs(p1 - ideal) +
      Math.abs(p2 - ideal) +
      Math.abs(p3 - ideal) +
      Math.abs(p4 - ideal)) /
    1.5;
  const olderPenalty = Math.max(0, p4 - 0.35) * 1.6;
  let raw = 1 - imbalance - olderPenalty;
  raw = Math.max(0, Math.min(1, raw));
  const noise = gaussian(rand) * 0.04; // small label noise, keeps it learnable but not a perfect fit
  return Math.max(0, Math.min(1, raw + noise));
}

// ---------------------------------------------------------------------------
// Tiny MLP: 4 -> 8 (tanh) -> 6 (tanh) -> 1 (sigmoid), trained by hand-rolled
// backprop. No ML framework dependency — small enough to write directly and
// keep fully auditable/deterministic.
// ---------------------------------------------------------------------------
interface Layer {
  W: number[][]; // W[j][i] = weight from input i to output neuron j
  b: number[];
}

function initLayer(nIn: number, nOut: number, rand: () => number): Layer {
  const scale = Math.sqrt(2 / (nIn + nOut));
  const W: number[][] = [];
  for (let j = 0; j < nOut; j++) {
    const row: number[] = [];
    for (let i = 0; i < nIn; i++) row.push((rand() * 2 - 1) * scale);
    W.push(row);
  }
  return { W, b: new Array(nOut).fill(0) };
}

function forwardLayer(layer: Layer, x: number[]): number[] {
  return layer.W.map((row, j) => {
    let sum = layer.b[j];
    for (let i = 0; i < row.length; i++) sum += row[i] * x[i];
    return sum;
  });
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

interface TrainedModel {
  l1: Layer; // 4 -> 8
  l2: Layer; // 8 -> 6
  l3: Layer; // 6 -> 1
}

function forwardFull(model: TrainedModel, x: number[]) {
  const z1 = forwardLayer(model.l1, x);
  const a1 = z1.map(Math.tanh);
  const z2 = forwardLayer(model.l2, a1);
  const a2 = z2.map(Math.tanh);
  const z3 = forwardLayer(model.l3, a2);
  const s = sigmoid(z3[0]);
  const yhat = s * 100;
  return { x, a1, a2, s, yhat };
}

// Max absolute gradient allowed to flow into the output layer per step —
// a safety net on top of the scale fix below. Earlier this trained directly
// against the 0-100 target with dyhat/dz3 = 100*s*(1-s), which combined with
// (yhat-y) also being up to +-100 made early gradients two orders of
// magnitude larger than they should be — the network's weights blew up
// within the first few hundred steps and got stuck saturated (sigmoid
// pinned near 0 for every input, which is exactly the "every card shows
// 0/100 regardless of age mix" bug this was caught from). Training now
// happens entirely in normalized [0,1] space (see trainStep's yTargetNorm
// param and buildTrainingSet below) so gradients stay small on their own;
// this clip is just a backstop in case a future tweak reintroduces a
// similar scale mismatch.
const MAX_GRADIENT = 5;
function clipGrad(v: number): number {
  return Math.max(-MAX_GRADIENT, Math.min(MAX_GRADIENT, v));
}

function trainStep(model: TrainedModel, x: number[], yTargetNorm: number, lr: number) {
  const { a1, a2, s } = forwardFull(model, x);

  // Loss is computed in NORMALIZED [0,1] space — L = (s - yTargetNorm)^2 —
  // not on the 0-100 display scale, so gradients stay well-behaved
  // regardless of how the final score happens to be scaled for display.
  const dL_ds = 2 * (s - yTargetNorm);
  const dz3 = clipGrad(dL_ds * s * (1 - s));

  // Layer 3 (6 -> 1)
  const dW3 = model.l3.W.map((row) => row.map((_, i) => dz3 * a2[i]));
  const db3 = [dz3];
  const da2 = model.l3.W[0].map((w) => dz3 * w);
  const dz2 = da2.map((d, i) => d * (1 - a2[i] * a2[i]));

  // Layer 2 (8 -> 6)
  const dW2 = model.l2.W.map((row, j) => row.map((_, i) => dz2[j] * a1[i]));
  const db2 = dz2.slice();
  const da1 = new Array(a1.length).fill(0);
  for (let j = 0; j < model.l2.W.length; j++) {
    for (let i = 0; i < model.l2.W[j].length; i++) {
      da1[i] += dz2[j] * model.l2.W[j][i];
    }
  }
  const dz1 = da1.map((d, i) => d * (1 - a1[i] * a1[i]));

  // Layer 1 (4 -> 8)
  const dW1 = model.l1.W.map((row, j) => row.map((_, i) => dz1[j] * x[i]));
  const db1 = dz1.slice();

  // SGD update
  const apply = (layer: Layer, dW: number[][], db: number[]) => {
    for (let j = 0; j < layer.W.length; j++) {
      for (let i = 0; i < layer.W[j].length; i++) {
        layer.W[j][i] -= lr * dW[j][i];
      }
      layer.b[j] -= lr * db[j];
    }
  };
  apply(model.l3, dW3, db3);
  apply(model.l2, dW2, db2);
  apply(model.l1, dW1, db1);
}

const TRAINING_SEED = 0x41474543; // "AGEC" — fixed, deterministic
const TRAINING_SAMPLES = 2500;
const TRAINING_EPOCHS = 40;
const LEARNING_RATE = 0.08;

/** y is kept normalized to [0,1] here — trainStep trains against this scale directly; predictAgeCohortScore multiplies by 100 only at inference/display time. */
function buildTrainingSet(rand: () => number): { x: number[]; y: number }[] {
  const set: { x: number[]; y: number }[] = [];
  for (let i = 0; i < TRAINING_SAMPLES; i++) {
    const mix = sampleMix(rand);
    const y = syntheticGroundTruthScore(mix, rand);
    set.push({ x: mix, y });
  }
  return set;
}

function trainModel(): TrainedModel {
  const rand = mulberry32(TRAINING_SEED);
  const model: TrainedModel = {
    l1: initLayer(4, 8, rand),
    l2: initLayer(8, 6, rand),
    l3: initLayer(6, 1, rand),
  };
  const trainingSet = buildTrainingSet(rand);
  for (let epoch = 0; epoch < TRAINING_EPOCHS; epoch++) {
    for (const sample of trainingSet) {
      trainStep(model, sample.x, sample.y, LEARNING_RATE);
    }
  }
  return model;
}

// Trained once per process, on first use — deterministic, so every process
// converges to identical weights (see determinism note in the file header).
let cachedModel: TrainedModel | null = null;
function getModel(): TrainedModel {
  if (!cachedModel) cachedModel = trainModel();
  return cachedModel;
}

function toVector(mix: AgeMix): number[] {
  return [mix.p2030, mix.p3040, mix.p4050, mix.p5065];
}

/** 0-100 age-cohort balance score for a given aggregate age mix. */
export function predictAgeCohortScore(mix: AgeMix): number {
  const { yhat } = forwardFull(getModel(), toVector(mix));
  return Math.round(yhat * 10) / 10;
}

export interface AgeCohortBandContribution {
  band: "20-30" | "30-40" | "40-50" | "50-65";
  /**
   * Model-derived effect (not hand-authored): how much the score would
   * change if this band were nudged halfway toward an even 25% split
   * (with the other three bands renormalized to still sum to 1). Positive
   * means this band is currently HELPING the score less than an even split
   * would — i.e. moving it toward 25% would raise the score further;
   * negative means this band is already better-than-even for the score.
   */
  effectIfRebalanced: number;
}

export interface AgeCohortExplanation {
  score: number;
  bandContributions: AgeCohortBandContribution[];
  /** The band whose rebalancing would move the score the most. */
  topDriver: AgeCohortBandContribution["band"] | null;
  summary: string;
}

const BAND_KEYS: (keyof AgeMix)[] = ["p2030", "p3040", "p4050", "p5065"];
const BAND_LABELS: Record<keyof AgeMix, AgeCohortBandContribution["band"]> = {
  p2030: "20-30",
  p3040: "30-40",
  p4050: "40-50",
  p5065: "50-65",
};

/**
 * Model-derived explainability: for each age band, perturb the mix halfway
 * toward an even split and re-run the trained network, so the "why" comes
 * from the model's own response to a counterfactual input, not from a
 * hand-written rule.
 */
export function explainAgeCohortScore(mix: AgeMix): AgeCohortExplanation {
  const base = predictAgeCohortScore(mix);

  const bandContributions: AgeCohortBandContribution[] = BAND_KEYS.map((key) => {
    const target = 0.25;
    const current = mix[key];
    const delta = (target - current) * 0.5;
    const others = BAND_KEYS.filter((k) => k !== key);
    const othersSum = others.reduce((s, k) => s + mix[k], 0);
    const adjusted: AgeMix = { ...mix };
    adjusted[key] = current + delta;
    for (const k of others) {
      adjusted[k] = othersSum > 0 ? mix[k] - (delta * mix[k]) / othersSum : mix[k];
    }
    const adjustedScore = predictAgeCohortScore(adjusted);
    return {
      band: BAND_LABELS[key],
      effectIfRebalanced: Math.round((adjustedScore - base) * 10) / 10,
    };
  });

  bandContributions.sort((a, b) => b.effectIfRebalanced - a.effectIfRebalanced);
  const top = bandContributions[0];
  const topDriver = top && top.effectIfRebalanced > 0.3 ? top.band : null;

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const mixText = `${pct(mix.p2030)} (20-30) / ${pct(mix.p3040)} (30-40) / ${pct(mix.p4050)} (40-50) / ${pct(mix.p5065)} (50-65)`;

  const summary = topDriver
    ? `Age mix is ${mixText}. The ${topDriver} band is the biggest drag on this combination's ` +
      `cohort-balance score (${base}/100) — moving it closer to an even 25% split would raise the ` +
      `score by roughly ${top.effectIfRebalanced}pt; the model was trained to reward an even spread ` +
      `and specifically penalize heavy 50-65 concentration.`
    : `Age mix is ${mixText}. No single band is a standout drag — this combination's cohort-balance ` +
      `score (${base}/100) is close to what a fully even 25/25/25/25 split would score.`;

  return { score: base, bandContributions, topDriver, summary };
}
