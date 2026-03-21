import React from "react";
import {
  ArrowDown,
  Briefcase,
  CheckCircle2,
  Compass,
  Gauge,
  GitBranch,
  Layers3,
  Link2,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const heroItems = [
  "Selling Framework Integration",
  "Signal Intelligence™ Measurement",
  "8 Behavioral Metrics",
  "Client Interpretation Layer",
];

const layeredModel = [
  {
    title: "Commercial Strategy",
    description: "Defines enterprise priorities and commercial outcomes.",
    icon: Briefcase,
  },
  {
    title: "Selling Framework",
    description: "Defines what good selling looks like across stages and standards.",
    icon: Compass,
  },
  {
    title: "Signal Intelligence™",
    description: "Measures observable behavior in live interactions without inferring intent.",
    icon: Gauge,
  },
  {
    title: "8 Behavioral Metrics",
    description: "Evaluates rep execution only and remains unchanged across customers.",
    icon: Layers3,
  },
  {
    title: "Client Interpretation Layer",
    description: "Applies enterprise frameworks, segmentation, and coaching context on top.",
    icon: Puzzle,
  },
  {
    title: "Rep Decision Execution",
    description: "Drives in-field choices, reinforcement, and coaching actions.",
    icon: Target,
  },
];

const stableItems = [
  "Signal Intelligence™ measurement model",
  "Observable conversation signals",
  "8 behavioral metrics",
  "Rep-only evaluation",
  "Consistent scoring structure",
];

const configurableItems = [
  "Selling framework terminology",
  "Stakeholder models",
  "Customer / patient segmentation",
  "Coaching language",
  "Scenario context",
  "Training overlays",
];

const useCases = [
  {
    title: "Context-Based Selling",
    description: "Applies situational context to how behavior is interpreted during practice and coaching.",
    layer: "Signal Intelligence still measures observable rep behavior while the context model guides interpretation.",
  },
  {
    title: "Stakeholder Segmentation",
    description: "Differentiates expectations by specialist, access, operational, or decision-making role.",
    layer: "The stakeholder framework changes coaching emphasis, not scoring logic.",
  },
  {
    title: "Patient / Customer Differentiation",
    description: "Frames field guidance around patient mix, customer type, or enterprise segmentation models.",
    layer: "Measurement stays constant while the overlay shapes enterprise training language.",
  },
  {
    title: "Proprietary Coaching Models",
    description: "Aligns manager language and field coaching standards to the client’s existing system.",
    layer: "ReflectivAI can reflect coaching structure without changing how performance is evaluated.",
  },
  {
    title: "Enterprise Sales Methodology Alignment",
    description: "Maps ReflectivAI usage to a client methodology without asking teams to replace it.",
    layer: "Signal Intelligence™ and the 8 behavioral metrics remain the stable common layer underneath.",
  },
];

const productSurfaces = [
  {
    title: "Role Play Simulator",
    description: "Scenario context framing + stakeholder setup",
    icon: Target,
  },
  {
    title: "AI Coach",
    description: "Coaching language alignment",
    icon: Sparkles,
  },
  {
    title: "Learning Paths",
    description: "Remediation structuring",
    icon: GitBranch,
  },
  {
    title: "Knowledge Base",
    description: "Framework-aligned content",
    icon: ShieldCheck,
  },
  {
    title: "Scenario Builder",
    description: "Scenario design inputs",
    icon: Link2,
  },
];

const protectionPoints = [
  "Signal Intelligence™ remains the behavioral measurement layer across all interactions.",
  "It measures observable behavior only.",
  "It does not infer intent, emotion, or personality.",
  "The 8 behavioral metrics evaluate rep execution only.",
  "Client frameworks do not change scoring logic.",
  "This does not change scoring.",
  "This preserves consistency across enterprise deployments.",
];

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description?: string;
};

type PageSectionProps = {
  children: React.ReactNode;
  tint?: "white" | "teal";
};

function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold text-slate-900 md:text-[2rem] md:leading-tight">{title}</h2>
      {description ? <p className="mt-3 text-sm leading-relaxed text-slate-600 md:text-[15px]">{description}</p> : null}
    </div>
  );
}

function PageSection({ children, tint = "white" }: PageSectionProps) {
  const sectionTone = tint === "teal"
    ? "ui-teal-section border-teal-200/90 shadow-[0_0_0_1px_rgba(13,148,136,0.16),0_16px_40px_rgba(15,23,42,0.05)]"
    : "bg-white border-teal-200/80 shadow-[0_0_0_1px_rgba(45,212,191,0.14),0_16px_40px_rgba(15,23,42,0.05)]";

  return (
    <section className={`rounded-[32px] border px-5 py-6 md:px-7 md:py-7 ${sectionTone}`}>
      {children}
    </section>
  );
}

type ListCardProps = {
  title: string;
  items: string[];
  tone: string;
  itemTone: string;
};

function ListCard({ title, items, tone, itemTone }: ListCardProps) {
  return (
    <div className={`rounded-[28px] border p-5 shadow-sm md:p-6 ${tone}`}>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <div key={item} className={`flex items-start gap-3 rounded-2xl border px-4 py-4 text-sm text-slate-700 shadow-sm ${itemTone}`}>
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-700" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CustomizationIntegration() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <section className="enterprise-hero mb-6 overflow-hidden p-6 md:mb-8 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-200">Enterprise configuration layer</p>
            <h1 className="mt-3 text-3xl font-bold text-white md:text-[40px] md:leading-[1.08]">
              Designed to integrate with how your teams already sell
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200 md:text-[15px]">
              ReflectivAI provides a consistent behavioral measurement system through Signal Intelligence™, while enabling enterprise frameworks, segmentation models, and coaching structures to be layered on top—without changing how performance is evaluated.
            </p>
          </div>

          <div className="enterprise-hero-panel w-full max-w-md p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-200">Framework alignment layer</p>
            <div className="mt-4 space-y-3">
              {heroItems.map((item) => (
                <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/20 px-4 py-3">
                  <p className="text-sm font-semibold text-white">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-6 md:space-y-8">
        <PageSection tint="white">
          <SectionHeader eyebrow="Why this matters" title="Enterprise teams already operate with defined selling frameworks and stakeholder models" />
          <div className="mt-5 space-y-4 text-sm leading-relaxed text-slate-600 md:max-w-4xl">
            <p>
              Enterprise teams already operate with defined selling frameworks and stakeholder models. However, decisions vary by clinical, access, and operational context.
            </p>
            <p>
              Most tools cannot operationalize those frameworks during live practice or coaching workflows. ReflectivAI bridges that gap by maintaining a consistent behavioral measurement layer while allowing enterprise-specific interpretation models to sit on top.
            </p>
          </div>
        </PageSection>

        <PageSection tint="teal">
          <SectionHeader
            eyebrow="Layered model"
            title="Measurement stays constant while enterprise interpretation layers on top"
            description="This is the core visual story for demos: a clean stack of layers that separates commercial structure, stable measurement, and client interpretation."
          />
          <div className="mt-6 space-y-4 md:space-y-5">
            {layeredModel.map((layer, index) => {
              const Icon = layer.icon;
              return (
                <React.Fragment key={layer.title}>
                  <div className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_14px_32px_rgba(15,23,42,0.07)] md:p-6">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 shadow-sm">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{layer.title}</h3>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{layer.description}</p>
                      </div>
                    </div>
                  </div>
                  {index < layeredModel.length - 1 ? (
                    <div className="flex justify-center py-1">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-100/90 text-teal-800 shadow-sm ring-1 ring-teal-200/90">
                        <ArrowDown className="h-5 w-5 stroke-[2.75]" />
                      </span>
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })}
          </div>
        </PageSection>

        <PageSection tint="white">
          <SectionHeader
            eyebrow="Stable vs customizable"
            title="Decision clarity: what stays constant vs. what can be configured"
            description="This section protects ReflectivAI architecture while showing the enterprise layer that can be aligned for customer needs."
          />
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ListCard
              title="What ReflectivAI Keeps Stable"
              items={stableItems}
              tone="border-teal-100 bg-teal-50/90"
              itemTone="border-teal-100 bg-white"
            />
            <ListCard
              title="What Can Be Configured"
              items={configurableItems}
              tone="border-slate-200 bg-white"
              itemTone="border-slate-200 bg-slate-50/75"
            />
          </div>
        </PageSection>

        <PageSection tint="teal">
          <SectionHeader
            eyebrow="Example enterprise use cases"
            title="Illustrative overlays that sit on top of Signal Intelligence™"
            description="These are example alignment patterns only. They do not imply new backend functionality or any change to measurement logic."
          />
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {useCases.map((useCase) => (
              <Card key={useCase.title} className="border-slate-200/70 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
                <CardContent className="p-5 md:p-6">
                  <h3 className="text-base font-semibold text-slate-900">{useCase.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{useCase.description}</p>
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/85 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">How it layers on Signal Intelligence</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{useCase.layer}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </PageSection>

        <PageSection tint="white">
          <SectionHeader
            eyebrow="Where this appears in the platform"
            title="A configuration and presentation layer across existing surfaces"
            description="This anchors the model to product surfaces that already exist in the platform today."
          />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {productSurfaces.map((surface) => {
              const Icon = surface.icon;
              return (
                <div key={surface.title} className="rounded-[28px] border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-teal-700 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900">{surface.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{surface.description}</p>
                </div>
              );
            })}
          </div>
        </PageSection>

        <PageSection tint="teal">
          <SectionHeader eyebrow="Signal Intelligence integrity" title="Signal Intelligence™ remains the protected measurement layer" />
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
            Signal Intelligence™ remains the behavioral measurement layer across all interactions. Client frameworks are interpretation overlays — not replacements for ReflectivAI scoring.
          </p>
          <div className="mt-5 space-y-3">
            {protectionPoints.map((point) => (
              <div key={point} className="ui-teal-surface flex min-h-[76px] items-center justify-start gap-3 rounded-2xl px-4 py-4 text-left text-sm text-slate-700 md:min-h-[72px] md:px-5">
                <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-teal-600" />
                <span className="leading-relaxed">{point}</span>
              </div>
            ))}
          </div>
        </PageSection>

        <section className="ui-teal-section rounded-[32px] border border-teal-200/90 px-5 py-6 text-center shadow-[0_0_0_1px_rgba(13,148,136,0.16),0_16px_40px_rgba(15,23,42,0.05)] md:px-7 md:py-7">
          <div className="mx-auto max-w-4xl">
            <h2 className="text-2xl font-bold text-slate-900">Consistent measurement. Flexible enterprise alignment.</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              ReflectivAI operationalizes your existing frameworks without requiring changes to how performance is measured.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
