import { Notice } from "@/components/ui/misc";
import type { AnalysisResponse } from "./analysis";

export function AnalysisBanner({ analysis }: { analysis: AnalysisResponse }) {
  return (
    <div className="flex flex-col gap-2">
      {analysis.ai_demo && (
        <Notice tone="error" title="Demo data, not real AI analysis">
          This server is running the development demo adapter. The numbers below are placeholders. Don&apos;t save them as real meals.
        </Notice>
      )}
      {analysis.notes.map((n) => (
        <Notice key={n} tone={analysis.ai_used ? "warn" : "info"}>{n}</Notice>
      ))}
      {analysis.unmatched.length > 0 && (
        <Notice tone="warn" title="Not matched">
          We couldn&apos;t find: {analysis.unmatched.join(", ")}. Search for them below or enter the calories yourself.
        </Notice>
      )}
      {analysis.follow_ups.length > 0 && (
        <Notice tone="info" title="Worth checking">
          <ul className="list-disc pl-5">{analysis.follow_ups.map((q) => <li key={q}>{q}</li>)}</ul>
          <p className="mt-1 text-xs">Adjust the quantities below. Nothing is re-analysed when you edit.</p>
        </Notice>
      )}
    </div>
  );
}
