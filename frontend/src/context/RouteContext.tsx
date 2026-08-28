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
  route: WorkflowStep;
  setRoute: (step: WorkflowStep) => void;
  visited: Set<WorkflowStep>;
}

export const RouteContext = createContext<RouteState | null>(null);

function currentHash(): string {
  return typeof window !== "undefined" ? window.location.hash : "";
}

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

    if (!workflowStepFromHash(currentHash())) {
      window.location.hash = hashForWorkflowStep(DEFAULT_WORKFLOW_STEP);
    }

    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const setRoute = useCallback((step: WorkflowStep) => {
    const hash = hashForWorkflowStep(step);
    if (window.location.hash === hash) {

      markVisited(step);
      return;
    }
    window.location.hash = hash;
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
