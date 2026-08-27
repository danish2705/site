import OpenAI from "openai";
import type {
  PipelineInput,
  RegionRow,
  RankedSite,
  RecommendationResult,
  RegionCandidate,
  RegionPrediction,
  RiskExplanation,
  LiveTrialBenchmark,
} from "../types.js";
import { config } from "../config.js";

const { model: MODEL, azureEndpoint, azureKey, openaiKey } = config.llm;

let client: OpenAI | null = null;
if (azureEndpoint && azureKey) {
  client = new OpenAI({
    apiKey: azureKey,
    baseURL: azureEndpoint.endsWith("/") ? azureEndpoint : `${azureEndpoint}/`,
    defaultHeaders: { "api-key": azureKey },
  });
} else if (openaiKey) {
  client = new OpenAI({ apiKey: openaiKey });
}

interface RecommendationArgs {
  input: PipelineInput;
  topRegion: RegionRow;
  estimatedPatients: number;
  top: RankedSite;
  riskExplanation: RiskExplanation;
}

export async function generateRecommendation({
  input,
  topRegion,
  estimatedPatients,
  top,
  riskExplanation,
}: RecommendationArgs): Promise<RecommendationResult> {
  if (!client) {
    return {
      llm: "mock",
      text:
        `[MOCK RESPONSE — no OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY set in backend/.env, so the LLM was not called] ` +
        `Recommended site: ${top.siteName} (${top.siteId}) in ${topRegion.Region}, ${topRegion.Country}. ` +
        `Suitability Score ${top.suitabilityScore}/100, Risk Level: ${top.overallRisk}. ` +
        `${riskExplanation.rule} ${riskExplanation.summary} ` +
        `Preferred based on enrollment history, investigator experience, and overall risk profile.`,
    };
  }

  const driverLines = riskExplanation.drivers
    .map(
      (d) =>
        `- ${d.riskId} [${d.category}, ${d.status}]: ${d.description} — ${d.derivation}`,
    )
    .join("\n");

  const prompt = `You are a clinical trial site-selection assistant. Using ONLY the facts given below
(do not invent or recompute any numbers), write a short 4-5 sentence final recommendation in plain
language. Reference the region, estimated patient population, the top recommended site, its
suitability score, and its risk level.

IMPORTANT: do not just state the risk level — explain WHY the site is rated ${top.overallRisk}.
Use the rating rule and the deciding risk records below, and say whether those records are still
open or already mitigated/closed, since that changes how much the rating should worry the reader.

Trial requirements: ${JSON.stringify(input)}
Selected region: ${topRegion.Region}, ${topRegion.Country}
Estimated eligible patient population: ${estimatedPatients}
Top recommended site: ${top.siteName} (${top.siteId})
Suitability score: ${top.suitabilityScore}/100
Risk level: ${top.overallRisk}

WHY THE RISK LEVEL IS ${top.overallRisk}
Rating rule: ${riskExplanation.rule}
Record mix: ${riskExplanation.totalRecords} record(s) total — ${riskExplanation.highCount} High, ${riskExplanation.mediumCount} Medium, ${riskExplanation.lowCount} Low.
Of the ${riskExplanation.driverTotal} deciding record(s), ${riskExplanation.activeAtLevel} are still Open or being Monitored.
Deciding records:
${driverLines || "- (none on file)"}
Note: each record's own rating comes from a Likelihood x Impact risk matrix, and a site inherits the
worst rating among its records.`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
  });

  return { llm: MODEL, text: completion.choices[0].message.content ?? "" };
}

interface PredictRegionArgs {
  input: PipelineInput;
  specialty: string;
  candidates: RegionCandidate[];
}

function parseJsonResponse<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

export async function predictRegionWithLLM({
  input,
  specialty,
  candidates,
}: PredictRegionArgs): Promise<RegionPrediction> {
  if (!client) throw new Error("No LLM client configured");

  const prompt = `You are a clinical trial feasibility analyst. Recommend ONE region for this trial.

TRIAL REQUIREMENTS
Indication: ${input.indication}
Required site specialty: ${specialty}
Phase: ${input.phase || "n/a"}
Target sample size: ${input.sampleSize ?? "n/a"}
Planned duration: ${input.durationMonths ?? "n/a"} months
Budget tier: ${input.budgetTier || "n/a"}

CANDIDATE REGIONS (pre-computed from the trial database — every figure below is already
calculated; do NOT recompute, rescale or invent any number, and do NOT propose a region
that is not in this list):
${JSON.stringify(candidates, null, 2)}

Field meanings: estimatedPatients = eligible patients in an assumed 5,000,000-person catchment;
siteCount = candidate sites in the required specialty; avgSuitability / bestSuitability are
0-100 site quality scores; highRiskPerSite = high-severity risk records per site;
monthsToEnroll = estimated months to reach the target sample size at historical enrollment
rates (null = not estimable); score = a weighted composite of all of the above (0-100).

Weigh the trade-offs for THIS trial specifically — e.g. a large phase III needs enrollment
capacity and site depth, a tight duration needs fast regulatory approval, a Low budget tier
needs cost discipline. You may pick a region that is not ranked first if the trade-offs
justify it.

Reply with ONLY a JSON object, no prose or markdown fences, in exactly this shape:
{
  "region": "<region, copied verbatim from the list>",
  "country": "<country, copied verbatim from the list>",
  "confidence": "Low" | "Medium" | "High",
  "confidenceReason": "<1-2 sentences on WHY this confidence level — e.g. how far clear this region is of the runner-up, or what data gap holds confidence down>",
  "rationale": "<3-4 sentences explaining why this region wins for this trial>",
  "keyFactors": ["<4-5 short bullet phrases, each citing a figure from the data>"],
  "watchOuts": ["<1-3 short bullet phrases naming real risks or limitations of this pick>"],
  "alternatives": [
    { "region": "<name>", "country": "<name>", "why": "<one sentence on when to prefer it instead>" }
  ]
}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "";
  const parsed = parseJsonResponse<Partial<RegionPrediction>>(raw);

  if (!parsed.region || !parsed.country) {
    throw new Error("LLM response did not name a region/country");
  }

  return {
    region: parsed.region,
    country: parsed.country,
    confidence:
      parsed.confidence === "High" || parsed.confidence === "Low"
        ? parsed.confidence
        : "Medium",
    confidenceReason: parsed.confidenceReason ?? "",
    rationale: parsed.rationale ?? "",
    keyFactors: Array.isArray(parsed.keyFactors) ? parsed.keyFactors : [],
    watchOuts: Array.isArray(parsed.watchOuts) ? parsed.watchOuts : [],
    alternatives: Array.isArray(parsed.alternatives)
      ? parsed.alternatives.filter((a) => a && a.region && a.country)
      : [],
  };
}

export interface SiteKpiEstimateInput {
  facilityName: string;
  city: string | null;
  state: string | null;
  country: string;
  indication: string;
  specialty: string;
  region: string;
  regulatoryWeeks: number;
  regionCompetingTrials: number;
  avgCostPerPatient: number;
  benchmark: LiveTrialBenchmark;
}

export interface SiteKpiEstimateFields {
  "Investigator Experience Score (0-10)": number | null;
  "Years Experience": number | null;
  "Prior Trials Count": number | null;
  "Historical Enrollment Rate (pts/month)": number | null;
  "Dropout Rate (%)": number | null;
  "Staff Availability Score (0-10)": number | null;
  "Infrastructure Readiness (%)": number | null;
  "Data Quality Score (0-100)": number | null;
  "Competing Trials at Site": number | null;
  "Screen Failure Rate (%)": number | null;
  "Protocol Deviation Rate (per 100 visits)": number | null;
  "Time to FPI (days)": number | null;
  "Site Start-up Time (days)": number | null;
  "Query Rate (per 100 CRF pages)": number | null;
  "Query Resolution Time (days)": number | null;
  "Data Entry Lag (days)": number | null;
  "Staff Turnover (%)": number | null;
  "GCP Certification Current (%)": number | null;
  "Site Cost per Patient (USD)": number | null;
  "Catchment Population": number | null;
  "Diversity Index (0-100)": number | null;
}

export interface SiteKpiEstimate {
  fields: SiteKpiEstimateFields;
  rationale: string;
}

const NUMERIC_FIELD_RANGES: Record<keyof SiteKpiEstimateFields, string> = {
  "Investigator Experience Score (0-10)": "0-10",
  "Years Experience": "0-40 (years)",
  "Prior Trials Count": "0-200 (integer)",
  "Historical Enrollment Rate (pts/month)": "0-40 (patients/month)",
  "Dropout Rate (%)": "2-30 (%)",
  "Staff Availability Score (0-10)": "0-10",
  "Infrastructure Readiness (%)": "0-100 (%)",
  "Data Quality Score (0-100)": "0-100",
  "Competing Trials at Site": "0-20 (integer)",
  "Screen Failure Rate (%)": "10-70 (%)",
  "Protocol Deviation Rate (per 100 visits)": "0.3-20 (per 100 visits)",
  "Time to FPI (days)": "14-200 (days)",
  "Site Start-up Time (days)": "21-220 (days)",
  "Query Rate (per 100 CRF pages)": "2-55 (per 100 CRF pages)",
  "Query Resolution Time (days)": "1-40 (days)",
  "Data Entry Lag (days)": "0.5-35 (days)",
  "Staff Turnover (%)": "2-50 (%)",
  "GCP Certification Current (%)": "40-100 (%)",
  "Site Cost per Patient (USD)": "USD, anchor to the regional average given below",
  "Catchment Population": "120000-5000000 (people)",
  "Diversity Index (0-100)": "12-98",
};

export async function estimateSiteKpis(
  input: SiteKpiEstimateInput,
): Promise<SiteKpiEstimate> {
  if (!client) {
    throw new Error(
      "LLM not configured (no OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY in backend/.env) — cannot estimate KPIs for this live site.",
    );
  }

  const phaseLines = Object.entries(input.benchmark.phaseDistribution)
    .map(([phase, count]) => `${phase}: ${count}`)
    .join(", ");

  const prompt = `You are a clinical trial site-feasibility analyst. A real facility below has been
identified from ClinicalTrials.gov as running trials for this condition, but ClinicalTrials.gov
does NOT publish any operational/performance data about it (no investigator experience, dropout
rate, cost, etc. is public anywhere). Your job is to give your best-informed estimate of that
site's operational KPIs, using the real context given below as your only grounding.

FACILITY
Name: ${input.facilityName}
Location: ${[input.city, input.state, input.country].filter(Boolean).join(", ")}
Required specialty: ${input.specialty}
Indication: ${input.indication}
Region grouping: ${input.region}

REAL CONTEXT FROM CLINICALTRIALS.GOV / REGIONAL DATA (use this to ground your estimate — do not
ignore it, and do not contradict it without reason)
Regulatory approval time in this country: ${input.regulatoryWeeks} weeks
Active competing trials in this region (all sites combined): ${input.regionCompetingTrials}
Regional average cost per patient: $${input.avgCostPerPatient}
Completed-trial benchmark for this indication (${input.benchmark.sampleCount} completed trials found):
  Phase mix: ${phaseLines || "no data"}
  Median sample size: ${input.benchmark.medianSampleSize ?? "no data"}
  Median duration: ${input.benchmark.medianDurationMonths ?? "no data"} months

INSTRUCTIONS
For each field below, give your best estimate within the stated range, reasoned from the facility
name/type (e.g. academic medical center vs community hospital), its location's regulatory and cost
context, and the indication's typical trial profile above. If you genuinely have no reasonable basis
for a field, return null for it rather than guessing a number — a null is scored as "missing data"
downstream, which is honest; a fabricated number is not.

Reply with ONLY a JSON object, no prose or markdown fences, in exactly this shape (all values are
number or null):
{
${Object.entries(NUMERIC_FIELD_RANGES)
  .map(([field, range]) => `  "${field}": <number or null, range ${range}>`)
  .join(",\n")},
  "rationale": "<2-3 sentences on what you grounded this estimate in and what you were least sure about>"
}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "";
  const parsed = parseJsonResponse<
    Partial<SiteKpiEstimateFields> & { rationale?: string }
  >(raw);

  const fields = {} as SiteKpiEstimateFields;
  for (const key of Object.keys(NUMERIC_FIELD_RANGES) as (keyof SiteKpiEstimateFields)[]) {
    const value = parsed[key];
    fields[key] = typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  const hasAnyValue = Object.values(fields).some((v) => v !== null);
  if (!hasAnyValue) {
    throw new Error(
      "LLM returned no usable KPI values for this site (all null or unparseable).",
    );
  }

  return {
    fields,
    rationale:
      typeof parsed.rationale === "string" && parsed.rationale.trim()
        ? parsed.rationale.trim()
        : "No rationale returned by the model.",
  };
}

export interface RegionMetricsEstimateInput {
  region: string;
  country: string;
  indication: string;
  specialty: string;
}

export interface RegionMetricsEstimateFields {
  prevalencePer100k: number | null;
  regulatoryApprovalWeeks: number | null;
  avgCostPerPatientUsd: number | null;
}

export interface RegionMetricsEstimate {
  fields: RegionMetricsEstimateFields;
  rationale: string;
}

function isContentFilterError(err: unknown): boolean {
  const e = err as { code?: string; error?: { code?: string } } | null;
  return e?.code === "content_filter" || e?.error?.code === "content_filter";
}

function buildRegionMetricsPrompt(
  input: RegionMetricsEstimateInput,
  variant: "default" | "reworded",
): string {
  if (variant === "default") {
    return `You are a clinical trial feasibility analyst. No public data source (not
ClinicalTrials.gov, not WHO, nowhere) publishes disease prevalence at the granularity of a
specific trial indication, regulatory approval time by country, or cost per patient by country/
region. Your job is to give your best-informed estimate of these three figures for the
region/country/indication below, reasoning from general country-level knowledge — regulatory
maturity, healthcare cost of living, and disease context for this indication.

REGION
Region grouping: ${input.region}
Country: ${input.country}
Indication: ${input.indication}
Required specialty: ${input.specialty}

INSTRUCTIONS
For each field below, give your best estimate within the stated range. If you genuinely have no
reasonable basis for a field, return null for it rather than guessing a number.

Reply with ONLY a JSON object, no prose or markdown fences, in exactly this shape:
{
  "prevalencePer100k": <number or null, range 1-2000>,
  "regulatoryApprovalWeeks": <number or null, range 4-52>,
  "avgCostPerPatientUsd": <number or null, range 500-15000>,
  "rationale": "<2-3 sentences on what you grounded this estimate in and what you were least sure about>"
}`;
  }

  const plainIndication = input.indication.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return `You are a market-sizing analyst supporting internal clinical-trial site-selection
business planning (NOT medical advice, NOT a clinical diagnosis or treatment recommendation).
No public data source publishes condition prevalence at this granularity, drug-approval timelines
by country, or per-patient trial cost by country/region, so provide a best-informed planning
estimate for the three numeric fields below, reasoning only from general country-level context
(regulatory maturity, healthcare cost of living, typical disease-area context).

PLANNING INPUT
Region grouping: ${input.region}
Country: ${input.country}
Condition area: ${plainIndication}
Relevant specialty: ${input.specialty}

INSTRUCTIONS
Give a best-effort numeric estimate within the stated range for each field. Return null only if
you truly have no reasonable basis.

Reply with ONLY a JSON object, no prose or markdown fences, in exactly this shape:
{
  "prevalencePer100k": <number or null, range 1-2000>,
  "regulatoryApprovalWeeks": <number or null, range 4-52>,
  "avgCostPerPatientUsd": <number or null, range 500-15000>,
  "rationale": "<2-3 sentences on what you grounded this estimate in and what you were least sure about>"
}`;
}

export async function estimateRegionMetrics(
  input: RegionMetricsEstimateInput,
): Promise<RegionMetricsEstimate> {
  if (!client) {
    throw new Error(
      "LLM not configured (no OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY in backend/.env) — cannot estimate region metrics.",
    );
  }

  const attempts: Array<"default" | "reworded"> = [
    "default",
    "default",
    "reworded",
  ];

  let lastErr: unknown;
  for (let i = 0; i < attempts.length; i++) {
    const variant = attempts[i];
    const prompt = buildRegionMetricsPrompt(input, variant);
    try {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0].message.content ?? "";
      const parsed = parseJsonResponse<
        Partial<RegionMetricsEstimateFields> & { rationale?: string }
      >(raw);

      const fields: RegionMetricsEstimateFields = {
        prevalencePer100k:
          typeof parsed.prevalencePer100k === "number" &&
          Number.isFinite(parsed.prevalencePer100k)
            ? parsed.prevalencePer100k
            : null,
        regulatoryApprovalWeeks:
          typeof parsed.regulatoryApprovalWeeks === "number" &&
          Number.isFinite(parsed.regulatoryApprovalWeeks)
            ? parsed.regulatoryApprovalWeeks
            : null,
        avgCostPerPatientUsd:
          typeof parsed.avgCostPerPatientUsd === "number" &&
          Number.isFinite(parsed.avgCostPerPatientUsd)
            ? parsed.avgCostPerPatientUsd
            : null,
      };

      const hasAnyValue = Object.values(fields).some((v) => v !== null);
      if (!hasAnyValue) {
        throw new Error(
          "LLM returned no usable region metric values (all null or unparseable).",
        );
      }

      if (i > 0) {
        console.log(
          `[estimateRegionMetrics] succeeded on attempt ${i + 1}/${attempts.length} ` +
            `(variant="${variant}") for "${input.indication}" after an earlier attempt failed.`,
        );
      }

      return {
        fields,
        rationale:
          "(AI-estimated) " +
          (typeof parsed.rationale === "string" && parsed.rationale.trim()
            ? parsed.rationale.trim()
            : "No rationale returned by the model."),
      };
    } catch (err) {
      lastErr = err;
      if (!isContentFilterError(err)) {
        throw err;
      }
      const contentFilterResult = (
        err as {
          error?: { innererror?: { content_filter_result?: unknown } };
        }
      )?.error?.innererror?.content_filter_result;
      console.error(
        `[estimateRegionMetrics] content_filter block on attempt ${i + 1}/${attempts.length} ` +
          `(variant="${variant}") for "${input.indication}" in ${input.country} — ` +
          `${i + 1 < attempts.length ? "retrying" : "giving up"}. ` +
          `content_filter_result: ${JSON.stringify(contentFilterResult)}`,
      );
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("LLM region-metrics estimate failed after retries.");
}

export interface RequirementThresholdEstimateInput {
  indication: string;
  specialty: string;
  phase: string;
}

export interface RequirementThresholdEstimateFields {
  minDataQualityScore: number | null;
  maxAcceptableScreenFailurePercent: number | null;
}

export interface RequirementThresholdEstimate {
  fields: RequirementThresholdEstimateFields;
  rationale: string;
}

export async function estimateRequirementThresholds(
  input: RequirementThresholdEstimateInput,
): Promise<RequirementThresholdEstimate> {
  if (!client) {
    throw new Error(
      "LLM not configured (no OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY in backend/.env) — cannot estimate requirement thresholds.",
    );
  }

  const prompt = `You are a clinical trial protocol design analyst. No public source discloses what
a trial's acceptable data-quality or screen-failure thresholds should be — these are protocol
design choices, not published facts. Your job is to estimate reasonable protocol thresholds for
THIS indication/phase combination, reasoning from typical trial rigor for that specialty/phase
(e.g. an early-phase oncology trial tolerates a much higher screen-failure rate than a late-phase
cardiology outcomes trial).

TRIAL
Indication: ${input.indication}
Required specialty: ${input.specialty}
Phase: ${input.phase}

INSTRUCTIONS
For each field below, give your best estimate within the stated range. If you genuinely have no
reasonable basis for a field, return null for it rather than guessing a number.

Reply with ONLY a JSON object, no prose or markdown fences, in exactly this shape:
{
  "minDataQualityScore": <number or null, range 0-100>,
  "maxAcceptableScreenFailurePercent": <number or null, range 5-70>,
  "rationale": "<1-2 sentences on what you grounded this estimate in>"
}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "";
  const parsed = parseJsonResponse<
    Partial<RequirementThresholdEstimateFields> & { rationale?: string }
  >(raw);

  const fields: RequirementThresholdEstimateFields = {
    minDataQualityScore:
      typeof parsed.minDataQualityScore === "number" &&
      Number.isFinite(parsed.minDataQualityScore)
        ? parsed.minDataQualityScore
        : null,
    maxAcceptableScreenFailurePercent:
      typeof parsed.maxAcceptableScreenFailurePercent === "number" &&
      Number.isFinite(parsed.maxAcceptableScreenFailurePercent)
        ? parsed.maxAcceptableScreenFailurePercent
        : null,
  };

  const hasAnyValue = Object.values(fields).some((v) => v !== null);
  if (!hasAnyValue) {
    throw new Error(
      "LLM returned no usable requirement threshold values (all null or unparseable).",
    );
  }

  return {
    fields,
    rationale:
      "(AI-estimated) " +
      (typeof parsed.rationale === "string" && parsed.rationale.trim()
        ? parsed.rationale.trim()
        : "No rationale returned by the model."),
  };
}

export async function inferSpecialtyForIndication(
  indication: string,
): Promise<string> {
  if (!client) {
    throw new Error(
      "LLM not configured — cannot infer specialty for an indication outside the static map.",
    );
  }

  const prompt = `What single medical specialty is required to run a clinical trial for this
indication?

Indication: ${indication}

Reply with ONLY a JSON object: { "specialty": "<specialty name>" }, no prose.`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "";
  const parsed = parseJsonResponse<{ specialty?: string }>(raw);

  const specialty = typeof parsed.specialty === "string" ? parsed.specialty.trim() : "";
  if (!specialty) {
    throw new Error(`LLM returned no usable specialty for indication "${indication}".`);
  }

  return specialty;
}

export function llmStatus(): { configured: boolean; model: string } {
  return { configured: !!client, model: MODEL };
}

export interface EligibilityFilterEstimateItem {
  id: string;
  label: string;
  detail: string;
  type: "inclusion" | "exclusion";
  estimatedExcludedPercent: number;
}

export interface EligibilityFilterEstimate {
  filters: EligibilityFilterEstimateItem[];
  rationale: string;
}

export async function estimateEligibilityFilterImpact(input: {
  indication: string;
  criteriaText: string;
}): Promise<EligibilityFilterEstimate> {
  if (!client) {
    throw new Error(
      "LLM not configured (no OPENAI_API_KEY or AZURE_OPENAI_ENDPOINT/AZURE_OPENAI_API_KEY in backend/.env) — cannot estimate eligibility-filter impact.",
    );
  }

  const prompt = `You are a clinical trial feasibility analyst. Below is the REAL, disclosed
eligibility criteria text for a trial in this indication, taken verbatim from ClinicalTrials.gov.
Extract EVERY distinct, clinically meaningful inclusion or exclusion criterion from it — do not
artificially limit how many you return, and do not invent criteria that aren't in the text. A
criterion left out here is still a real exclusion in practice; it just wouldn't be selectable by
the user, so completeness matters more than brevity of the list. For each one, give your
best-informed estimate of what percentage of the GENERAL population of people who have this
indication would be excluded by that single criterion alone (not cumulative with the others). No
public source publishes this percentage — reason from general epidemiology and typical
comorbidity/demographic rates for this condition.

INDICATION: ${input.indication}

REAL ELIGIBILITY CRITERIA TEXT (verbatim from ClinicalTrials.gov):
"""
${input.criteriaText}
"""

INSTRUCTIONS
1. Do NOT extract a pure age-range criterion (e.g. "Age 18-65", "Age outside 18-55"). Eligible age
   is already a separate, dedicated selection elsewhere in this app, so repeating it here would be
   redundant — skip it even if the text states one.
2. When the text lumps several organ systems/conditions into one criterion (e.g. "clinically
   significant renal, hepatic, or cardiovascular disease", "significant comorbidities"), DO NOT
   return that as a single vague line. Split it into separate, specific, named-disease checkboxes
   instead (e.g. "Chronic kidney disease", "Liver disease", "Heart disease", "Type 1 or type 2
   diabetes" — whichever specific conditions the lumped phrase actually implies for this
   indication). Each split-out disease still needs its own estimatedExcludedPercent — don't just
   copy the same number to every split item if their real-world prevalence would differ. Splitting
   a criterion this way must NOT reduce how many OTHER, unrelated criteria you extract — extract
   every meaningful criterion in the text, whether or not another one needed splitting.
3. Include criteria that would meaningfully change a recruitment estimate (pregnancy, specific
   comorbidities, prior treatment/trial history, lab-value ranges, concurrent trial participation,
   recent vaccination, drug hypersensitivity, etc.). You may skip purely administrative ones (e.g.
   "able to provide informed consent") since those don't affect the addressable patient count.
4. If the text is too vague to extract any meaningful criterion, return an empty filters array
   rather than inventing one.
5. EVERY "label" must be a short, plain phrase of 45 characters or fewer that reads cleanly as one
   checkbox line (e.g. "Chronic kidney disease", "Pregnant or breastfeeding") — never a full
   clinical sentence. Put any fuller clinical wording/thresholds/qualifiers that don't fit in the
   45-character label into a separate "detail" field instead (e.g. label "Severity threshold not
   met", detail "PASI score <12, BSA <10%, or sPGA <3 at screening"). If the label alone already
   says everything needed, repeat it verbatim as "detail".

Reply with ONLY a JSON object, no prose or markdown fences, in exactly this shape:
{
  "filters": [
    {
      "label": "<short checkbox phrase, <=45 characters, e.g. 'Chronic kidney disease'>",
      "detail": "<fuller clinical wording for a tooltip, or the same as label if nothing more to add>",
      "type": "inclusion" | "exclusion",
      "estimatedExcludedPercent": <number 0-100>
    }
  ],
  "rationale": "<1-2 sentences on how you estimated these percentages>"
}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "";
  const parsed = parseJsonResponse<{
    filters?: Array<{
      label?: string;
      detail?: string;
      type?: string;
      estimatedExcludedPercent?: number;
    }>;
    rationale?: string;
  }>(raw);

  const FILTER_COUNT_SAFETY_CAP = 40;
  const MAX_FILTER_LABEL_LENGTH = 45;

  const seenIds = new Set<string>();
  const filters: EligibilityFilterEstimateItem[] = (
    Array.isArray(parsed.filters) ? parsed.filters : []
  )
    .filter(
      (f) =>
        f &&
        typeof f.label === "string" &&
        f.label.trim() &&
        typeof f.estimatedExcludedPercent === "number" &&
        Number.isFinite(f.estimatedExcludedPercent),
    )
    .slice(0, FILTER_COUNT_SAFETY_CAP)
    .map((f) => {
      const trimmedLabel = f.label!.trim();
      const fullDetail =
        typeof f.detail === "string" && f.detail.trim()
          ? f.detail.trim()
          : trimmedLabel;
      const label =
        trimmedLabel.length > MAX_FILTER_LABEL_LENGTH
          ? `${trimmedLabel.slice(0, MAX_FILTER_LABEL_LENGTH - 1).trimEnd()}…`
          : trimmedLabel;
      const detail =
        label !== trimmedLabel && fullDetail === trimmedLabel
          ? trimmedLabel
          : fullDetail;

      let id = trimmedLabel
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      if (!id) id = "criterion";
      while (seenIds.has(id)) id = `${id}-2`;
      seenIds.add(id);
      return {
        id,
        label,
        detail,
        type: f.type === "inclusion" ? "inclusion" : "exclusion",
        estimatedExcludedPercent: Math.max(
          0,
          Math.min(100, Math.round(f.estimatedExcludedPercent!)),
        ),
      };
    });

  return {
    filters,
    rationale:
      "(AI-estimated) " +
      (typeof parsed.rationale === "string" && parsed.rationale.trim()
        ? parsed.rationale.trim()
        : "No rationale returned by the model."),
  };
}

export interface SiteGeoRiskInput {
  facilityName: string;
  city: string | null;
  state: string | null;
  country: string;
  indication: string;
}

export interface SiteGeoRiskEstimate {
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  rationale: string;
}

const geoRiskCache = new Map<
  string,
  { estimate: SiteGeoRiskEstimate; expiresAt: number }
>();

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

export async function estimateSiteGeoRisk(
  input: SiteGeoRiskInput,
): Promise<SiteGeoRiskEstimate> {
  if (!client) {
    throw new Error("LLM not configured — cannot estimate a site risk score.");
  }

  const cacheKey =
    `${input.facilityName}|${input.city ?? ""}|${input.country}|${input.indication}`.toLowerCase();
  const cached = geoRiskCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.estimate;

  const prompt = `You are a clinical trial feasibility analyst. No public database of per-site
clinical-trial risk scores exists, so give your best-informed general risk assessment for running
a trial at this facility, reasoning only from its location's regulatory maturity, healthcare
infrastructure maturity, and typical trial density for this indication — NOT any measured fact
about this specific facility (none is public).

FACILITY
Name: ${input.facilityName}
Location: ${[input.city, input.state, input.country].filter(Boolean).join(", ")}
Indication: ${input.indication}

Reply with ONLY a JSON object, no prose or markdown fences:
{
  "riskScore": <number 0-100, higher = riskier>,
  "riskLevel": "Low" | "Medium" | "High",
  "rationale": "<1-2 sentences on what you grounded this in>"
}`;

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content ?? "";
  const parsed = parseJsonResponse<Partial<SiteGeoRiskEstimate>>(raw);

  if (typeof parsed.riskScore !== "number" || !Number.isFinite(parsed.riskScore)) {
    throw new Error("LLM returned no usable risk score.");
  }

  const estimate: SiteGeoRiskEstimate = {
    riskScore: clampScore(parsed.riskScore),
    riskLevel:
      parsed.riskLevel === "Low" || parsed.riskLevel === "High"
        ? parsed.riskLevel
        : "Medium",
    rationale:
      "(AI-estimated) " +
      (typeof parsed.rationale === "string" && parsed.rationale.trim()
        ? parsed.rationale.trim()
        : "No rationale returned by the model."),
  };

  geoRiskCache.set(cacheKey, {
    estimate,
    expiresAt: Date.now() + config.ctgov.cacheTtlMs,
  });
  return estimate;
}
