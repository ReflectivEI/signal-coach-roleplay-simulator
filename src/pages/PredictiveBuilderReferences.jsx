import { useEffect, useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import { Activity, ExternalLink, FileText, RefreshCw, ShieldCheck } from "lucide-react";
import { PREDICTIVE_REFERENCE_APPENDIX } from "@/lib/predictiveReferences";
import { listEvidenceSources } from "@/services/workerClient";
import continuousLearningProfile from "@/lib/continuousLearningProfile.json";

/** @typedef {{ id: string; organization: string; title: string; publisher: string; year: string; url: string; domain?: string; type?: string }} PredictiveReference */

/** @param {PredictiveReference} entry */
function formatReference(entry) {
    return `${entry.organization}. ${entry.title}. ${entry.publisher}; ${entry.year}. Available from: ${entry.url}`;
}

export default function PredictiveBuilderReferences() {
    const [references, setReferences] = useState(/** @type {PredictiveReference[]} */(PREDICTIVE_REFERENCE_APPENDIX));
    const policy = continuousLearningProfile?.policy || {};
    const weights = continuousLearningProfile?.weights || {};
    const updatedAt = continuousLearningProfile?.updatedAt
        ? new Date(continuousLearningProfile.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
        : "Tracked nightly";

    useEffect(() => {
        let isMounted = true;

        async function hydrateFromAllowlist() {
            try {
                const sources = await listEvidenceSources();
                if (!isMounted || !sources.length) return;

                const merged = sources.map(/** @param {any} source */(source) => {
                    const existing = PREDICTIVE_REFERENCE_APPENDIX.find((item) => item.id === source.id);
                    return {
                        id: source.id,
                        organization: existing?.organization || source.organization || source.id,
                        title: existing?.title || "Allowlisted evidence source",
                        publisher: existing?.publisher || source.organization || "Curated Source",
                        year: existing?.year || "2024",
                        url: source.url,
                        domain: source.domain || existing?.domain || "cross-domain",
                        type: source.type || existing?.type || "source",
                    };
                });

                setReferences(merged);
            } catch {
                // Keep static fallback if worker is not reachable.
            }
        }

        void hydrateFromAllowlist();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <div className="min-h-screen font-inter" style={{ background: "linear-gradient(180deg, #f7fbfc 0%, #eef5f6 38%, #f8fbfc 100%)" }}>
            <AppHeader maxWidthClassName="max-w-[1180px]" />

            <div className="max-w-[1180px] mx-auto px-6 py-8 space-y-6">
                <div
                    className="rounded-[24px] p-6"
                    style={{
                        background: "linear-gradient(94deg, hsl(223 52% 14%) 0%, hsl(213 54% 20%) 42%, hsl(187 42% 18%) 100%)",
                        border: "1px solid rgba(89, 125, 175, 0.34)",
                        boxShadow: "0 18px 38px rgba(14, 24, 43, 0.10)",
                    }}
                >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                        <div className="max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.22em] mb-2" style={{ color: "hsl(174 62% 76%)" }}>
                                Current Intelligence Refresh
                            </p>
                            <h1 className="text-2xl font-semibold text-white">How Signal Intelligence stays current</h1>
                            <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(235,248,248,0.86)" }}>
                                The platform uses a governed refresh loop: allowlisted evidence sources update the Predictive Builder reference layer, while nightly evaluation artifacts check dialogue realism, opener adaptation, persona calibration, QA risk, and cross-path parity before any runtime profile is promoted.
                            </p>
                        </div>
                        <div className="rounded-2xl border px-4 py-3 min-w-[220px]" style={{ borderColor: "rgba(174, 231, 224, 0.24)", background: "rgba(255,255,255,0.08)" }}>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "rgba(173, 240, 231, 0.90)" }}>Learning profile</p>
                            <p className="mt-1 text-sm font-semibold text-white">Policy v{continuousLearningProfile?.version || 1}</p>
                            <p className="text-xs" style={{ color: "rgba(235,248,248,0.72)" }}>Last baseline: {updatedAt}</p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-3 mt-5">
                        {[
                            {
                                Icon: RefreshCw,
                                title: "Nightly learning loop",
                                body: "Reads recent QA and regression artifacts, writes auditable latest/trend reports, and only promotes when policy passes.",
                            },
                            {
                                Icon: ShieldCheck,
                                title: "Guarded source updates",
                                body: "Uses allowlisted clinical and publication references; no uncontrolled scraping or hidden model training.",
                            },
                            {
                                Icon: Activity,
                                title: "Behavioral calibration",
                                body: `Weights confidence (${Math.round((weights.confidence || 0) * 100)}%), opener adaptation, persona lanes, QA risk, and parity checks.`,
                            },
                        ].map(({ Icon, title, body }) => (
                            <div
                                key={title}
                                className="rounded-2xl border p-4"
                                style={{
                                    borderColor: "rgba(174, 231, 224, 0.20)",
                                    background: "rgba(255,255,255,0.07)",
                                }}
                            >
                                <Icon className="w-4 h-4 mb-3" style={{ color: "hsl(174 62% 76%)" }} />
                                <p className="text-sm font-semibold text-white">{title}</p>
                                <p className="mt-1 text-xs leading-relaxed" style={{ color: "rgba(235,248,248,0.74)" }}>{body}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {[
                            `Confidence ≥ ${Math.round((policy.minConfidenceGate || 0) * 100)}%`,
                            `Opener adaptation ≥ ${Math.round((policy.minOpenerAdaptation || 0) * 100)}%`,
                            `Persona calibration ≥ ${Math.round((policy.minPersonaLanePassRate || 0) * 100)}%`,
                            `Parity ≥ ${Math.round((policy.minCrossPathParity || 0) * 100)}%`,
                        ].map((label) => (
                            <span
                                key={label}
                                className="text-[11px] font-semibold rounded-full border px-3 py-1"
                                style={{
                                    color: "rgba(235,248,248,0.90)",
                                    borderColor: "rgba(174, 231, 224, 0.22)",
                                    background: "rgba(255,255,255,0.08)",
                                }}
                            >
                                {label}
                            </span>
                        ))}
                    </div>
                </div>

                <div
                    className="rounded-[24px] p-6"
                    style={{
                        background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(242,248,249,0.98) 100%)",
                        border: "1.5px solid rgba(92, 135, 165, 0.36)",
                        boxShadow: "0 14px 32px rgba(14, 24, 43, 0.05), inset 0 1px 0 rgba(255,255,255,0.68)",
                    }}
                >
                    <div className="mb-4">
                        <span className="font-semibold" style={{ color: "hsl(222 48% 22%)" }}>Predictive Builder References</span>
                        <span className="text-sm ml-2" style={{ color: "hsl(215 18% 46%)" }}>Appendix of credible clinical and publication sources</span>
                    </div>
                    <div className="flex items-center gap-2 mb-4" style={{ color: "hsl(222 48% 22%)" }}>
                        <FileText className="w-4 h-4" />
                        <h1 className="text-sm font-semibold uppercase tracking-wider">References Appendix</h1>
                    </div>
                    <p className="text-sm mb-4" style={{ color: "hsl(213 20% 33%)" }}>
                        This appendix lists the currently allowlisted and curated references used by the Predictive Builder intelligence layer. Reference format follows a concise publication style for fast rep review.
                    </p>

                    <ol className="space-y-3">
                        {references.map((entry) => (
                            <li
                                key={entry.id}
                                className="rounded-xl p-3"
                                style={{
                                    background: "rgba(20, 56, 89, 0.05)",
                                    border: "1px solid rgba(92, 135, 165, 0.24)",
                                }}
                            >
                                <p className="text-sm" style={{ color: "hsl(213 20% 26%)", lineHeight: 1.55 }}>
                                    {formatReference(entry)}
                                </p>
                                <a
                                    href={entry.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium"
                                    style={{ color: "hsl(198 57% 35%)" }}
                                >
                                    Open source
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </div>
    );
}
