import React from "react";
import RolePlaySimulator from "./RolePlaySimulator";

class FlawlessSimulatorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
      lastErrorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      lastErrorMessage: error?.message || "Unexpected simulator error",
    };
  }

  componentDidCatch(error, errorInfo) {
    // eslint-disable-next-line no-console
    console.error("RolePlaySimulatorFlawless fallback triggered:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState((prevState) => ({
      hasError: false,
      retryCount: prevState.retryCount + 1,
      lastErrorMessage: "",
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto mt-20 max-w-3xl rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900 shadow-sm">
          <h1 className="text-xl font-semibold">Role Play Simulator — Flawless Mode</h1>
          <p className="mt-2 text-sm leading-6">
            The simulator hit an unexpected issue and was safely isolated before it could impact your progress.
          </p>
          <p className="mt-2 text-xs text-emerald-800/80">
            Error detail: {this.state.lastErrorMessage || "Unavailable"}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Restart simulator
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-md border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              Full page refresh
            </button>
          </div>
        </div>
      );
    }

    return <RolePlaySimulator key={`flawless-session-${this.state.retryCount}`} flawlessMode />;
  }
}

export default function RolePlaySimulatorFlawless() {
  return <FlawlessSimulatorBoundary />;
}
