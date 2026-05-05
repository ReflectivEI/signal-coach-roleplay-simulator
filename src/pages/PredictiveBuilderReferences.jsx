import { useEffect, useState } from "react";
import AppHeader from "@/components/layout/AppHeader";
import { ExternalLink, FileText } from "lucide-react";
import { PREDICTIVE_REFERENCE_APPENDIX } from "@/lib/predictiveReferences";
import { listEvidenceSources } from "@/services/workerClient";

/** @typedef {{ id: string; organization: string; title: string; publisher: string; year: string; url: string; domain?: string; type?: string }} PredictiveReference */

/** @param {PredictiveReference} entry */
function formatReference(entry) {
    return `${entry.organization}. ${entry.title}. ${entry.publisher}; ${entry.year}. Available from: ${entry.url}`;
}

export default function PredictiveBuilderReferences() {
    const [references, setReferences] = useState(/** @type {PredictiveReference[]} */(PREDICTIVE_REFERENCE_APPENDIX));

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
