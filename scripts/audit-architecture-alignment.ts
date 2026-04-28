import { promises as fs } from "node:fs";
import path from "node:path";
import { ALL_SCENARIOS } from "../src/lib/scenarioCatalog.js";
import { getScenarioCapabilityProfile, getScenarioConcernFamily } from "../src/lib/scenarioFamilyRegistry.ts";

const ALLOWED = {
    diseaseState: new Set([
        "pulmonology",
        "cardiology",
        "rheumatology",
        "neurology",
        "oncology",
        "nephrology",
        "dermatology",
        "hematology",
        "gastroenterology",
        "endocrinology",
        "primary_care",
    ]),
    specialty: new Set(["specialist", "primary_care", "hospital_medicine", "academic"]),
    hcpType: new Set(["treating_clinician", "influencer", "thought_leader"]),
    influenceDriver: new Set(["patient_centric", "evidence_driven", "risk_averse", "guideline_anchored"]),
    journeyStage: new Set([
        "initial_access",
        "discovery",
        "clinical_value",
        "objection_handling",
        "adoption_implementation",
        "access_formulary",
        "commitment_close",
    ]),
    interactionPressure: new Set([
        "time_constrained",
        "operationally_constrained",
        "skeptical_resistant",
        "competitive_bias",
        "safety_concern",
        "access_barrier",
        "curious_uncertain",
    ]),
};

function hasAllFiveSectionLabels(summaryModalSource: string) {
    const labels = [
        "1) Brief Rationale",
        "2) Capabilities Done Well",
        "3) Capabilities to Develop",
        "4) Signal–Response Alignment",
        "5) Specific Action Items",
    ];
    return labels.every((label) => summaryModalSource.includes(label));
}

function hasRepOnlySotRule(sotSource: string) {
    return sotSource.includes("The rep is the only scored entity.") && sotSource.includes("The HCP is the deterministic simulation counterpart.");
}

function hasRequiredReviewContract(sessionReviewSource: string) {
    const requiredSnippets = [
        "Field: briefRationale",
        "Field: didWell",
        "Field: biggestGap",
        "Field: nextAdjustment",
        "Field: signalResponseAlignment[]",
        "observationLevel values (effective / developing / missed) are behavioral signal classifications",
    ];
    return requiredSnippets.every((snippet) => sessionReviewSource.includes(snippet));
}

async function main() {
    const mappingIssues: Array<{ title: string; field: string; value: string }> = [];
    const profileIssues: string[] = [];

    for (const scenario of ALL_SCENARIOS) {
        const mapping = scenario.gridMapping || {};
        const requiredFields = [
            "diseaseState",
            "specialty",
            "hcpType",
            "influenceDriver",
            "journeyStage",
            "interactionPressure",
        ] as const;

        for (const field of requiredFields) {
            const value = String(mapping[field] || "").trim();
            if (!value) {
                mappingIssues.push({ title: scenario.title, field, value: "missing" });
                continue;
            }
            if (!ALLOWED[field].has(value)) {
                mappingIssues.push({ title: scenario.title, field, value });
            }
        }

        if (!getScenarioConcernFamily(scenario)) {
            profileIssues.push(`${scenario.title}: missing concern family mapping`);
        }
        if (!getScenarioCapabilityProfile(scenario)) {
            profileIssues.push(`${scenario.title}: missing capability profile mapping`);
        }
    }

    const root = path.resolve(".");
    const [summaryModalSource, sessionReviewSource, sotSource] = await Promise.all([
        fs.readFile(path.join(root, "src/components/simulator/SessionSummaryModal.jsx"), "utf8"),
        fs.readFile(path.join(root, "src/lib/sessionReview.ts"), "utf8"),
        fs.readFile(path.join(root, "docs/CURRENT_CANONICAL_SOT_STANDALONE.md"), "utf8"),
    ]);

    const report = {
        scenarioCount: ALL_SCENARIOS.length,
        checks: {
            sixDimensionGridMapping: {
                pass: mappingIssues.length === 0,
                issues: mappingIssues,
            },
            familyAndCapabilityProfileCoverage: {
                pass: profileIssues.length === 0,
                issues: profileIssues,
            },
            fiveSectionFeedbackUi: {
                pass: hasAllFiveSectionLabels(summaryModalSource),
            },
            sessionReviewContract: {
                pass: hasRequiredReviewContract(sessionReviewSource),
            },
            repOnlyScoringSotRule: {
                pass: hasRepOnlySotRule(sotSource),
            },
        },
    };

    console.log(JSON.stringify(report, null, 2));

    const allPass = Object.values(report.checks).every((check: any) => check.pass);
    if (!allPass) process.exitCode = 1;
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
