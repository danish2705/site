import { useEffect, useRef, useState } from "react";
import { usePipeline } from "../../hooks/usePipeline";
import { fetchNctLookup } from "../../services/nctLookup.service";
import { searchRareDiseases } from "../../services/rareDisease.service";
import type { NctLookupResponse, RareDiseaseSearchResult, TrialForm } from "../../types";

interface LandingScreenProps {
  /** Leaves the landing screen and shows the normal Dashboard (workflow +
      results) once an NCT-derived run has already been kicked off — see
      handleConfirmRun below. Zero form interaction, so this skips the
      Analysis Parameters form entirely. */
  onEnterDashboard: () => void;
  /** "Enter Study Details Manually" goes here instead — the full-page
      Analysis Parameters form (ParametersFormPage), not straight to the
      dashboard, since there's nothing to run yet until that form is
      submitted. */
  onStartManual: () => void;
  /** Selecting a live Orphanet search result opens the Rare Disease page for
      that ORPHAcode — see App.tsx's "rare-disease" entry mode. */
  onOpenRareDisease: (orphaCode: string) => void;
}

const NCT_ID_PATTERN = /^NCT\d{6,9}$/i;
const RARE_DISEASE_SEARCH_MIN_CHARS = 2;
const RARE_DISEASE_SEARCH_DEBOUNCE_MS = 300;

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function LandingIllustration() {
  // Soft "cloud of blobs" + location pin — no external image asset. The
  // main blob is a handful of overlapping, seam-free circles/ellipses (a
  // cheap way to get an organic puffy shape without a hand-drawn path),
  // plus a few smaller separate blobs scattered around it, matching the
  // reference mockup's abstract map-illustration style. Rendered against a
  // plain white panel (see .landing-left) so these soft --primary-light
  // shapes read clearly instead of blending into a same-colored background.
  return (
    <svg viewBox="0 0 320 200" className="landing-illustration" aria-hidden="true">
      {/* Main blob cluster */}
      <ellipse cx="160" cy="145" rx="105" ry="42" fill="var(--primary-light)" />
      <circle cx="95" cy="122" r="42" fill="var(--primary-light)" />
      <circle cx="225" cy="125" r="46" fill="var(--primary-light)" />
      <circle cx="160" cy="98" r="48" fill="var(--primary-light)" />

      {/* Small scattered accent blobs */}
      <circle cx="42" cy="55" r="15" fill="var(--primary-light)" />
      <circle cx="26" cy="82" r="8" fill="var(--primary-light)" />
      <circle cx="278" cy="58" r="13" fill="var(--primary-light)" />
      <circle cx="296" cy="80" r="7" fill="var(--primary-light)" />
      <circle cx="252" cy="172" r="9" fill="var(--primary-light)" />

      {/* Location pin */}
      <path
        d="M160 40c-24.3 0-44 19.7-44 44 0 33 44 76 44 76s44-43 44-76c0-24.3-19.7-44-44-44Z"
        fill="var(--primary)"
      />
      <circle cx="160" cy="84" r="16" fill="var(--card)" />
    </svg>
  );
}

export default function LandingScreen({
  onEnterDashboard,
  onStartManual,
  onOpenRareDisease,
}: LandingScreenProps) {
  const { runAnalysisFromNct } = usePipeline();
  const [nctInput, setNctInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<NctLookupResponse | null>(null);

  // Rare Disease live search-as-you-type — real Orphanet nomenclature only,
  // no pre-loaded list (unlike the Indication field's SearchableSelect,
  // there's nothing sensible to pre-load here).
  const [rareQuery, setRareQuery] = useState("");
  const [rareOpen, setRareOpen] = useState(false);
  const [rareResults, setRareResults] = useState<RareDiseaseSearchResult[]>([]);
  const [rareLoading, setRareLoading] = useState(false);
  const [rareError, setRareError] = useState<string | null>(null);
  // This is the last box on the page, so its dropdown often has nowhere to
  // open downward into (see the flip logic RequirementChecklistPopover.tsx
  // already uses for the same reason) — flips to open upward instead
  // whenever there's more room above the input than below it.
  const [rareMenuFlip, setRareMenuFlip] = useState(false);
  const rareWrapRef = useRef<HTMLDivElement>(null);
  const rareInputWrapRef = useRef<HTMLDivElement>(null);
  const rareRequestIdRef = useRef(0);

  useEffect(() => {
    const el = rareInputWrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    setRareMenuFlip(spaceBelow < 260 && spaceAbove > spaceBelow);
  }, [rareOpen]);

  useEffect(() => {
    const trimmed = rareQuery.trim();
    if (trimmed.length < RARE_DISEASE_SEARCH_MIN_CHARS) {
      setRareResults([]);
      setRareLoading(false);
      setRareError(null);
      return;
    }
    setRareLoading(true);
    setRareError(null);
    const myRequestId = ++rareRequestIdRef.current;
    const timer = setTimeout(() => {
      searchRareDiseases(trimmed)
        .then(({ results }) => {
          if (rareRequestIdRef.current !== myRequestId) return;
          setRareResults(results);
          setRareLoading(false);
        })
        .catch((err) => {
          if (rareRequestIdRef.current !== myRequestId) return;
          setRareResults([]);
          setRareLoading(false);
          setRareError((err as Error).message);
        });
    }, RARE_DISEASE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [rareQuery]);

  useEffect(() => {
    if (!rareOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (rareWrapRef.current && !rareWrapRef.current.contains(e.target as Node)) {
        setRareOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [rareOpen]);

  function handleSelectRareDisease(result: RareDiseaseSearchResult) {
    setRareOpen(false);
    setRareQuery("");
    onOpenRareDisease(result.orphaCode);
  }

  async function handleSearch() {
    const id = nctInput.trim();
    if (!id) {
      setSearchError("Enter an NCT number first.");
      return;
    }
    if (!NCT_ID_PATTERN.test(id)) {
      setSearchError(`"${id}" doesn't look like a valid NCT number (expected e.g. NCT01234567).`);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const result = await fetchNctLookup(id);
      setLookupResult(result);
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }

  function handleTryAnother() {
    setLookupResult(null);
    setSearchError(null);
  }

  function handleConfirmRun() {
    if (!lookupResult || !lookupResult.indication) return;
    const newForm: TrialForm = {
      indication: lookupResult.indication,
      phase: lookupResult.phase ?? "",
      sampleSize: lookupResult.enrollmentCount ?? "",
      durationMonths: lookupResult.durationMonths ?? "",
      // No live source for budget tier — this run is scoped to the trial's
      // own disclosed sites (see runAnalysisFromNct), so cost is excluded
      // from the scoring entirely rather than guessing a tier the trial
      // never disclosed.
      budgetTier: "All",
      // Left empty — the trial's own disclosed site countries drive this
      // run instead (see runAnalysisFromNct/nctScope), not a manual region
      // pre-selection.
      regions: [],
      ageGroups: lookupResult.ageGroups,
    };
    onEnterDashboard();
    runAnalysisFromNct(lookupResult, newForm);
  }

  return (
    <div className="landing-screen">
      <div className="landing-card">
        <div className="landing-left">
          <LandingIllustration />
          <h1 className="landing-title">Clinical Trial Site Selection</h1>
          <p className="landing-subtitle">
            Find the best sites for your clinical study using real-world data
            and AI.
          </p>
        </div>

        <div className="landing-right">
          {!lookupResult ? (
            <>
              <div className="landing-panel">
                <h2 className="landing-panel-title">Search by NCT Number</h2>
                <label className="landing-field-label" htmlFor="nct-input">
                  Enter NCT number
                </label>
                <input
                  id="nct-input"
                  className="landing-input"
                  type="text"
                  placeholder="NCT01234567"
                  value={nctInput}
                  disabled={searching}
                  onChange={(e) => setNctInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                />
                <button
                  type="button"
                  className="btn-primary landing-search-btn"
                  onClick={handleSearch}
                  disabled={searching}
                >
                  <SearchIcon />
                  {searching ? "Searching…" : "Search"}
                </button>
                {searchError && <p className="landing-error">{searchError}</p>}
              </div>

              <div className="landing-divider">
                <span>OR</span>
              </div>

              <div className="landing-panel">
                <h2 className="landing-panel-title">Enter Study Details Manually</h2>
                <p className="landing-panel-hint">Start a new analysis</p>
                <button
                  type="button"
                  className="btn-secondary landing-manual-btn"
                  onClick={onStartManual}
                >
                  Start Analysis
                </button>
              </div>

              <div className="landing-divider">
                <span>OR</span>
              </div>

              <div className="landing-panel" ref={rareWrapRef}>
                <h2 className="landing-panel-title">Rare Disease Lookup</h2>
                <p className="landing-panel-hint">
                  Real Orphanet data — prevalence, incidence, inheritance, age of onset
                </p>
                <label className="landing-field-label" htmlFor="rare-disease-input">
                  Search a disease name
                </label>
                <div className="landing-rare-search-wrap" ref={rareInputWrapRef}>
                  <input
                    id="rare-disease-input"
                    className="landing-input"
                    type="text"
                    placeholder="e.g. Marfan syndrome"
                    value={rareQuery}
                    onChange={(e) => {
                      setRareQuery(e.target.value);
                      setRareOpen(true);
                    }}
                    onFocus={() => setRareOpen(true)}
                    autoComplete="off"
                  />
                  {rareOpen && rareQuery.trim().length >= RARE_DISEASE_SEARCH_MIN_CHARS && (
                    <ul className={`landing-rare-menu${rareMenuFlip ? " landing-rare-menu--up" : ""}`}>
                      {rareLoading && <li className="ui-select-status">Searching Orphanet…</li>}
                      {!rareLoading && rareError && (
                        <li className="ui-select-status">{rareError}</li>
                      )}
                      {!rareLoading && !rareError && rareResults.length === 0 && (
                        <li className="ui-select-status">No matching rare disease found.</li>
                      )}
                      {!rareLoading &&
                        !rareError &&
                        rareResults.map((r) => (
                          <li key={r.orphaCode}>
                            <button
                              type="button"
                              className="ui-select-option"
                              onClick={() => handleSelectRareDisease(r)}
                            >
                              {r.name}
                              <span className="landing-rare-orphacode">ORPHA:{r.orphaCode}</span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="landing-panel landing-confirm">
              <h2 className="landing-panel-title">
                Found: {lookupResult.nctId}
              </h2>
              <p className="landing-confirm-brief-title">
                {lookupResult.briefTitle ?? lookupResult.officialTitle ?? "Untitled study"}
              </p>

              <dl className="landing-confirm-grid">
                <dt>Indication</dt>
                <dd>{lookupResult.indication ?? "Not disclosed"}</dd>

                <dt>Phase</dt>
                <dd>{lookupResult.phase ?? "Not disclosed"}</dd>

                <dt>Status</dt>
                <dd>{lookupResult.overallStatus ?? "Unknown"}</dd>

                <dt>Age Group</dt>
                <dd>
                  {lookupResult.ageGroups.length > 0
                    ? lookupResult.ageGroups.join(", ")
                    : "All ages"}
                </dd>

                <dt>Target Enrollment</dt>
                <dd>
                  {lookupResult.enrollmentCount != null
                    ? lookupResult.enrollmentCount.toLocaleString()
                    : "Not disclosed"}
                </dd>

                <dt>Duration</dt>
                <dd>
                  {lookupResult.durationMonths != null
                    ? `${lookupResult.durationMonths} months`
                    : "Not disclosed"}
                </dd>

                <dt>Disclosed Trial Sites</dt>
                <dd>
                  {lookupResult.siteCount > 0
                    ? `${lookupResult.siteCount} location(s) in ${lookupResult.countries.join(", ") || "unknown countries"}`
                    : "None disclosed"}
                </dd>

                <dt>Region / Budget</dt>
                <dd>Searching globally · All budget levels (no cost constraint)</dd>
              </dl>

              {!lookupResult.indication && (
                <p className="landing-error">
                  This study doesn't disclose a condition, so an analysis
                  can't be auto-run from it — try Enter Study Details
                  Manually instead.
                </p>
              )}

              <div className="landing-confirm-actions">
                <button
                  type="button"
                  className="btn-primary landing-run-btn"
                  onClick={handleConfirmRun}
                  disabled={!lookupResult.indication}
                >
                  Run Analysis
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleTryAnother}
                >
                  Try a Different NCT Number
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
