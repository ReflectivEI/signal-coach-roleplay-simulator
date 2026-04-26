import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BrainCircuit } from "lucide-react";
import EnterpriseBanner from "@/components/layout/EnterpriseBanner";
import { buildPredictiveProfile, PREDICTIVE_SELECTOR_OPTIONS } from "@/lib/predictiveBuilderModel";

const INITIAL_SELECTION = {
  diseaseState: "",
  hcpType: "",
  journeyStage: "",
  interactionPressure: "",
  influenceDriver: "",
  behaviorArchetype: "",
};

function SelectField({ label, value, options, onChange }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "hsl(222 46% 25%)" }}>
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,249,249,0.98) 100%)",
          border: "1.5px solid rgba(92, 135, 165, 0.42)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78), 0 1px 3px rgba(14, 24, 43, 0.03)",
        }}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PredictiveBuilder() {
  const [selection, setSelection] = useState(INITIAL_SELECTION);

  const allSelected = Object.values(selection).every(Boolean);

  const profile = useMemo(() => {
    if (!allSelected) return null;
    return buildPredictiveProfile(selection);
  }, [allSelected, selection]);

  const setField = (field) => (value) => setSelection((current) => ({ ...current, [field]: value }));

  return (
    <div className="min-h-screen font-inter" style={{ background: "linear-gradient(180deg, #f7fbfc 0%, #eef5f6 38%, #f8fbfc 100%)" }}>
      <div
        className="sticky top-0 z-10 backdrop-blur-xl"
        style={{
          background: "rgba(255,255,255,0.84)",
          borderBottom: "1px solid rgba(38, 67, 117, 0.18)",
          boxShadow: "0 10px 24px rgba(14, 24, 43, 0.06)",
        }}
      >
        <div className="max-w-[1180px] mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/" className="transition-colors" style={{ color: "hsl(222 52% 24%)" }}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="font-semibold" style={{ color: "hsl(222 48% 22%)" }}>Predictive HCP Builder</span>
            <span className="text-sm ml-2" style={{ color: "hsl(215 18% 46%)" }}>UI-only profile foundation (v2 shell)</span>
          </div>
        </div>
      </div>

      <div className="max-w-[1180px] mx-auto px-6 py-8 space-y-6">
        <EnterpriseBanner
          title="Predictive HCP Builder"
          subtitle="Build a deterministic HCP profile from six selectors without changing current simulator behavior."
        />

        <div
          className="rounded-[24px] p-6 space-y-5"
          style={{
            background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
            border: "1.5px solid rgba(92, 135, 165, 0.36)",
            boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <SelectField label="Disease State" value={selection.diseaseState} options={PREDICTIVE_SELECTOR_OPTIONS.diseaseState} onChange={setField("diseaseState")} />
            <SelectField label="Specialty / HCP Type" value={selection.hcpType} options={PREDICTIVE_SELECTOR_OPTIONS.hcpType} onChange={setField("hcpType")} />
            <SelectField label="Journey Stage" value={selection.journeyStage} options={PREDICTIVE_SELECTOR_OPTIONS.journeyStage} onChange={setField("journeyStage")} />
            <SelectField label="Interaction Pressure" value={selection.interactionPressure} options={PREDICTIVE_SELECTOR_OPTIONS.interactionPressure} onChange={setField("interactionPressure")} />
            <SelectField label="Influence Driver" value={selection.influenceDriver} options={PREDICTIVE_SELECTOR_OPTIONS.influenceDriver} onChange={setField("influenceDriver")} />
            <SelectField label="Behavior Archetype" value={selection.behaviorArchetype} options={PREDICTIVE_SELECTOR_OPTIONS.behaviorArchetype} onChange={setField("behaviorArchetype")} />
          </div>
        </div>

        {!allSelected && (
          <div className="rounded-2xl p-5 text-sm" style={{ background: "rgba(30, 64, 175, 0.07)", border: "1px solid rgba(30, 64, 175, 0.2)", color: "hsl(220 30% 32%)" }}>
            Select all six fields to render the Predictive Profile Card.
          </div>
        )}

        {profile && (
          <div
            className="rounded-[24px] p-6"
            style={{
              background: "linear-gradient(180deg, hsl(222 44% 17%) 0%, hsl(215 42% 18%) 100%)",
              border: "1px solid rgba(66, 132, 145, 0.45)",
              boxShadow: "0 18px 38px rgba(15, 23, 42, 0.16)",
            }}
          >
            <div className="flex items-center gap-2 mb-4" style={{ color: "hsl(169 56% 66%)" }}>
              <BrainCircuit className="w-4 h-4" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Predictive Profile Card</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <ProfileItem label="HCP mindset" value={profile.mindset} />
              <ProfileItem label="Likely objections" value={profile.likelyObjections} />
              <ProfileItem label="Pressure signals" value={profile.pressureSignals} />
              <ProfileItem label="Red flags" value={profile.redFlags} />
              <ProfileItem label="Language that works" value={profile.languageThatWorks} />
              <ProfileItem label="Language that triggers resistance" value={profile.languageThatTriggersResistance} />
              <ProfileItem label="Predicted response style" value={profile.predictedResponseStyle} />
              <ProfileItem label="Recommended REP approach" value={profile.recommendedRepApproach} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileItem({ label, value }) {
  return (
    <div className="rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(138, 200, 210, 0.2)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "hsl(168 62% 74%)" }}>
        {label}
      </p>
      <p style={{ color: "hsl(193 35% 90%)", lineHeight: 1.5 }}>{value}</p>
    </div>
  );
}
