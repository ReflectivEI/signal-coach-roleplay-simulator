import React from "react";
import RolePlaySimulator from "./RolePlaySimulator";

class SafeSimulatorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    // eslint-disable-next-line no-console
    console.error("RolePlaySimulatorSafe fallback triggered:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto mt-20 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
          <h1 className="text-xl font-semibold">Safe Role-Play Simulator</h1>
          <p className="mt-2 text-sm leading-6">
            The isolated simulator encountered an unexpected issue and was safely stopped to protect session state.
            Please refresh and retry.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function RolePlaySimulatorSafe() {
  return (
    <SafeSimulatorBoundary>
      <RolePlaySimulator />
    </SafeSimulatorBoundary>
  );
}
