import type { AiLikeItem } from "@/lib/draft";

export interface AnalysisResponse {
  items: AiLikeItem[];
  follow_ups: string[];
  unmatched: string[];
  ai_used: boolean;
  ai_available: boolean;
  ai_demo: boolean;
  notes: string[];
  image_path?: string | null;
  image_stored?: boolean;
}

export type InputMethod = "photo" | "text" | "voice";

export interface AnalysisMeta {
  method: InputMethod;
  originalInput: string | null;
  imagePath: string | null;
}

export class AnalysisError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}

/** POST to an analyze route and unwrap the {data} / {error} envelope. */
export async function postAnalysis(url: string, body: BodyInit, json = true): Promise<AnalysisResponse> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body, headers: json ? { "Content-Type": "application/json" } : undefined });
  } catch {
    throw new AnalysisError("Couldn't reach the server. Check your connection and try again.", "network");
  }
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new AnalysisError(j?.error?.details?.[0]?.message ?? j?.error?.message ?? "Something went wrong. Please try again.", j?.error?.code ?? "error");
  return j.data as AnalysisResponse;
}
