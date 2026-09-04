"use client";

import { useState } from "react";
import type { AlgoMeta } from "@/lib/algorithms";

/**
 * The written explanation for one algorithm, shown in the single-solve sidebar.
 * The plain-language description and "what you see" are open by default; the
 * measured strengths / weaknesses / verdict sit behind a toggle so the panel
 * doesn't dominate the sidebar.
 */
export function AlgoExplainer({ meta }: { meta: AlgoMeta }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded border border-border bg-bg-raised">
      <div className="border-b border-border/60 px-4 py-3">
        <h2 className="num text-[12px] text-text">{meta.label}</h2>
        <p className="mt-0.5 num text-[10px] text-text-faint">
          emits: {meta.emits}
        </p>
        <p className="mt-2 text-[12px] italic leading-relaxed text-text-dim">
          {meta.tagline}
        </p>
      </div>

      <div className="max-h-[340px] overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-2.5 text-[12px] leading-relaxed text-text-dim">
          {meta.explainer.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>

        <Section title="on screen">{meta.onScreen}</Section>

        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-3 num text-[11px] text-text-faint hover:text-text-dim"
        >
          {open ? "− measured behaviour" : "+ measured behaviour"}
        </button>

        {open && (
          <div className="mt-1">
            <Section title="strengths">{meta.strengths}</Section>
            <Section title="weaknesses">{meta.weaknesses}</Section>
            <Section title="when it wins, when it loses">{meta.verdict}</Section>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <h3 className="num text-[10px] uppercase tracking-wider text-text-faint">
        {title}
      </h3>
      <p className="mt-1 text-[12px] leading-relaxed text-text-dim">{children}</p>
    </div>
  );
}
