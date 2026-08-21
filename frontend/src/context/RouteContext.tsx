import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_WORKFLOW_STEP,
  hashForWorkflowStep,
  workflowStepFromHash,
  type WorkflowStep,
} from "../constants/workflow";

export interface RouteState {
  /** The currently active page of the 8-step guided workflow. */
  route: WorkflowStep;
  /** Navigate to a step — used by WorkflowNav, WizardNextLink, and the Run Analysis auto-navigate. */
  setRoute: (step: WorkflowStep) => void;
  /** Every step the user has visited this session — drives WorkflowNav's "completed" affordance for steps that don't otherwise have a clear done/not-done signal (predict, the 3 site-map pages, ongoing trials). */
  visited: Set<WorkflowStep>;
}

export const RouteContext = createContext<RouteState | null>(null);

function currentHash(): string {
  return typeof window !== "undefined" ? window.location.hash : "";
}

/**
 * Hash-based router (#/predict, #/site-map, ...) — no router library is
 * installed in this app, and a real path-based router would need the
 * backend to serve index.html for arbitrary paths (a backend change, out
 * of scope here). Using `location.hash` gives real browser Back/Forward
 * button support and shareable URLs for free: setting `location.hash`
 * pushes a normal history entry and fires `hashchange`, and the browser's
 * own Back/Forward buttons fire that same event when traversing those
 * entries — so one listener covers every navigation path.
 */
export function RouteProvider({ children }: { children: ReactNode }) {
  const initialStep = workflowStepFromHash(currentHash()) ?? DEFAULT_WORKFLOW_STEP;
  const [route, setRouteState] = useState<WorkflowStep>(initialStep);
  const [visited, setVisited] = useState<Set<WorkflowStep>>(
    () => new Set([initialStep]),
  );

  const markVisited = useCallback((step: WorkflowStep) => {
    setVisited((prev) => (prev.has(step) ? prev : new Set(prev).add(step)));
  }, []);

  useEffect(() => {
    function onHashChange() {
      const next = workflowStepFromHash(window.location.hash);
      if (next) {
        setRouteState(next);
        markVisited(next);
      }
    }
    window.addEventListener("hashchange", onHashChange);

    // No recognized step in the URL yet (fresh load with no hash, or a
    // stale/unknown one) — canonicalize to the default step's hash.
    if (!workflowStepFromHash(currentHash())) {
      window.location.hash = hashForWorkflowStep(DEFAULT_WORKFLOW_STEP);
    }

    return () => window.removeEventListener("hashchange", onHashChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setRoute = useCallback((step: WorkflowStep) => {
    const hash = hashForWorkflowStep(step);
    if (window.location.hash === hash) {
      // Already there (e.g. re-clicking the active nav item) — nothing to
      // navigate, but still make sure it's marked visited.
      markVisited(step);
      return;
    }
    // Triggers the hashchange listener above, which updates `route`/`visited`.
    window.location.hash = hash;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markVisited]);

  const value: RouteState = { route, setRoute, visited };

  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useRoute(): RouteState {
  const ctx = useContext(RouteContext);
  if (!ctx) {
    throw new Error("useRoute() must be used within a RouteProvider");
  }
  return ctx;
}
