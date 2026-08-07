import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  // Renders the fallback UI shown in place of the crashed subtree. Passed
  // the actual error and a reset() to try re-rendering the children again
  // (e.g. after the user closes and re-opens whatever triggered it).
  fallback: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

// A render error anywhere below this boundary used to take the whole app
// down to a blank white screen (React unmounts from the nearest error
// boundary — which, with none in the tree, was the document root). This
// contains the crash to whatever subtree it wraps and — just as
// importantly — puts the real error message on screen instead of nothing,
// so "it went blank" turns into an actual, reportable message.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] caught a render error:", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset);
    }
    return this.props.children;
  }
}
