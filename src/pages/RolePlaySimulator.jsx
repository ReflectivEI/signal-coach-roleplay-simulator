import EnterpriseScenarioCard from "@/components/roleplay/EnterpriseScenarioCard";

const STUB_SCENARIO = {
  title: "Standalone RPS Redirect",
  difficulty: "intermediate",
};

export default function RolePlaySimulator() {
  // Route-level navigation redirects users to the standalone RPS host.
  // Keep this component lightweight for local contracts/tests that still inspect this file.
  return (
    <div className="hidden" aria-hidden>
      <EnterpriseScenarioCard scenario={STUB_SCENARIO} allowStart={false} />
    </div>
  );
}
