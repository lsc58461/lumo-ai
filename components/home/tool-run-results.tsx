"use client";

import { Check, CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";

import {
  toolCatalog,
  type ToolExecutionResult,
  type ToolPreviewBadge,
} from "@/lib/lumo-content";
import { cn } from "@/lib/utils";

interface ToolRunResultsProps {
  toolResults: ToolExecutionResult[];
}

const elementClassName = {
  wood: "text-emerald-300",
  fire: "text-rose-300",
  earth: "text-orange-200",
  metal: "text-slate-100",
  water: "text-cyan-300",
} as const;

const badgeToneClassName = {
  amber: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  cyan: "border-cyan-300/20 bg-cyan-300/10 text-cyan-100",
  emerald: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  rose: "border-rose-300/20 bg-rose-300/10 text-rose-100",
  violet: "border-violet-300/20 bg-violet-300/10 text-violet-100",
  slate: "border-white/10 bg-white/[0.04] text-zinc-200",
} as const;

function PreviewBadge({ badge }: { badge: ToolPreviewBadge }) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border px-2.5 py-2.5 md:rounded-2xl md:px-3 md:py-3",
        badgeToneClassName[badge.tone ?? "slate"],
      )}
    >
      <div className="text-[11px] tracking-[0.18em] uppercase opacity-70">{badge.label}</div>
      <div className="mt-1 text-[13px] font-semibold wrap-break-word md:text-sm">
        {badge.value}
      </div>
      {badge.subvalue ? (
        <div className="mt-1 text-[11px] wrap-break-word opacity-80 md:text-xs">
          {badge.subvalue}
        </div>
      ) : null}
    </div>
  );
}

function SajuPreview({
  result,
}: {
  result: Extract<ToolExecutionResult, { variant: "saju" }>;
}) {
  return (
    <div className="max-w-full overflow-x-auto rounded-[18px] border border-white/10 bg-white/4 p-2 md:rounded-[22px] md:p-2.5">
      <table className="w-full min-w-64 table-fixed text-center md:min-w-75">
        <thead>
          <tr className="text-[10px] text-zinc-500 md:text-[11px]">
            {result.pillars.headers.map((header) => (
              <th key={header} className="pb-1.5 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {result.pillars.heavenly.map((cell, index) => {
              const pillarHeader = result.pillars.headers[index] ?? `heavenly-${cell.hanja}`;

              return (
                <td key={`${pillarHeader}-${cell.hanja}`} className="pb-1 align-top">
                  <div
                    className={cn(
                      "text-[24px] leading-none font-semibold md:text-[28px]",
                      elementClassName[cell.element],
                    )}
                  >
                    {cell.hanja}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-400 md:text-[11px]">
                    {cell.label}
                  </div>
                </td>
              );
            })}
          </tr>
          <tr>
            {result.pillars.earthly.map((cell, index) => {
              const pillarHeader = result.pillars.headers[index] ?? `earthly-${cell.hanja}`;

              return (
                <td key={`${pillarHeader}-${cell.hanja}`} className="pt-1 align-top">
                  <div
                    className={cn(
                      "text-[24px] leading-none font-semibold md:text-[28px]",
                      elementClassName[cell.element],
                    )}
                  >
                    {cell.hanja}
                  </div>
                  <div className="mt-0.5 text-[10px] text-zinc-400 md:text-[11px]">
                    {cell.label}
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      <div className="mt-2 inline-flex max-w-full items-start gap-1 text-[10px] whitespace-pre-line text-zinc-400 md:mt-2.5 md:text-[11px]">
        <CircleHelp className="size-3.5" />
        {result.pillars.note}
      </div>
    </div>
  );
}

function ZiweiPreview({
  result,
}: {
  result: Extract<ToolExecutionResult, { variant: "ziwei" }>;
}) {
  return (
    <div className="grid max-w-full gap-1.5 overflow-hidden rounded-[20px] border border-white/10 bg-white/4 p-2.5 md:grid-cols-4 md:gap-2 md:rounded-[24px] md:p-3">
      {result.grid.palaces.slice(0, 12).map((palace) => (
        <div
          key={`${palace.name}-${palace.branch}`}
          className={cn(
            "rounded-xl border border-white/10 bg-[#181926] px-2.5 py-2 md:rounded-2xl md:px-3 md:py-2.5",
            palace.emphasis === "ming" && "border-cyan-300/25",
            palace.emphasis === "core" && "border-cyan-300/20",
          )}
        >
          <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500 md:text-[11px]">
            <span>{palace.name}</span>
            <span>{palace.branch}</span>
          </div>
          <div className="mt-1.5 text-[13px] font-semibold text-zinc-100 md:mt-2 md:text-sm">
            {palace.stars.join(" · ")}
          </div>
        </div>
      ))}
      <div className="rounded-xl border border-violet-300/20 bg-violet-300/10 p-2.5 md:col-span-4 md:rounded-2xl md:p-3">
        <div className="text-[13px] font-semibold text-violet-100 md:text-sm">
          {result.grid.centerTitle}
        </div>
        <div className="mt-1 text-[11px] leading-5 text-violet-100/90 md:text-xs md:leading-6">
          {result.grid.centerLines.join(" / ")}
        </div>
      </div>
    </div>
  );
}

function BadgeGrid({ badges }: { badges: ToolPreviewBadge[] }) {
  return (
    <div className="grid max-w-full gap-1.5 md:grid-cols-4 md:gap-2">
      {badges.map((badge) => (
        <PreviewBadge key={`${badge.label}-${badge.value}`} badge={badge} />
      ))}
    </div>
  );
}

function TarotPreview({
  result,
}: {
  result: Extract<ToolExecutionResult, { variant: "tarot" }>;
}) {
  return (
    <div className="grid max-w-full gap-1.5 md:grid-cols-3 md:gap-2">
      {result.cards.map((card) => (
        <div
          key={`${card.slot}-${card.name}`}
          className="min-w-0 rounded-[20px] border border-white/10 bg-white/4 p-2.5 md:rounded-[24px] md:p-3"
        >
          <div className="text-[10px] tracking-[0.16em] text-zinc-500 uppercase md:text-[11px] md:tracking-[0.18em]">
            {card.slot}
          </div>
          <div className="mt-1.5 text-[15px] font-semibold wrap-break-word text-zinc-100 md:mt-2 md:text-base">
            {card.name}
          </div>
          <p className="mt-1.5 text-[13px] leading-5 wrap-break-word text-zinc-400 md:mt-2 md:text-sm md:leading-6">
            {card.meaning}
          </p>
        </div>
      ))}
    </div>
  );
}

function ToolPreview({ result }: { result: ToolExecutionResult }) {
  switch (result.variant) {
    case "saju":
      return <SajuPreview result={result} />;
    case "ziwei":
      return <ZiweiPreview result={result} />;
    case "astrology":
    case "vedic":
      return <BadgeGrid badges={result.placements} />;
    case "tarot":
      return <TarotPreview result={result} />;
    case "sukyo":
    case "mahabote":
      return <BadgeGrid badges={result.badges} />;
    default:
      return null;
  }
}

function ToolRunResults({ toolResults }: ToolRunResultsProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [toolResults]);

  return (
    <div className="max-w-full min-w-0 space-y-2.5 overflow-hidden md:space-y-3">
      {toolResults.map((result, index) => (
        <div
          key={result.id}
          className={cn(
            "min-w-0 space-y-2 transition-all duration-500 md:space-y-2.5",
            isVisible
              ? "blur-0 translate-y-0 opacity-100"
              : "translate-y-2 opacity-0 blur-[2px]",
          )}
          style={{ transitionDelay: `${index * 90}ms` }}
        >
          <div className="inline-flex flex-wrap items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-100 md:gap-2 md:px-3 md:text-xs">
            <Check className="size-3.5" />
            <span className="font-semibold">{result.label}</span>
            {toolCatalog[result.toolKey].beta ? (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-amber-100 uppercase">
                beta
              </span>
            ) : null}
            <span>분석 완료</span>
            <span className="break-all text-emerald-100/75">({result.args})</span>
          </div>
          <p className="rounded-[20px] border border-white/10 bg-white/3 px-3 py-2 text-[13px] leading-6 wrap-break-word text-zinc-300 md:rounded-[24px] md:px-4 md:py-3 md:text-sm">
            {result.summary}
          </p>
          <ToolPreview result={result} />
        </div>
      ))}
    </div>
  );
}

export default ToolRunResults;
