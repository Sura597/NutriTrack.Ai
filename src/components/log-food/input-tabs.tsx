"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, ImagePlus, Loader2, Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resizeImage } from "@/lib/image-resize";
import { AnalysisError, postAnalysis, type AnalysisMeta, type AnalysisResponse } from "./analysis";

type Done = (r: AnalysisResponse, meta: AnalysisMeta) => void;

export function InputTabs({ onDone, onSkip }: { onDone: Done; onSkip: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Tabs defaultValue="text">
        <TabsList aria-label="How do you want to log?">
          <TabsTrigger value="photo"><Camera className="size-4" aria-hidden /> Photo</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
          <TabsTrigger value="voice"><Mic className="size-4" aria-hidden /> Voice</TabsTrigger>
        </TabsList>
        <TabsContent value="photo"><PhotoTab onDone={onDone} /></TabsContent>
        <TabsContent value="text"><TextTab onDone={onDone} /></TabsContent>
        <TabsContent value="voice"><VoiceTab onDone={onDone} /></TabsContent>
      </Tabs>
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={onSkip}>
        Skip: search foods or enter calories manually
      </Button>
    </div>
  );
}

/* ------------------------------- Text ------------------------------- */

function TextTab({ onDone }: { onDone: Done }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setError(null);
    setBusy(true);
    try {
      const r = await postAnalysis("/api/food/analyze-text", JSON.stringify({ text }));
      onDone(r, { method: "text", originalInput: text.trim(), imagePath: null });
    } catch (e) {
      setError(e instanceof AnalysisError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium" htmlFor="meal-text">What did you eat?</label>
      <Textarea
        id="meal-text"
        value={text}
        maxLength={1000}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. 2 rotis, 1 bowl dal, 1 cup rice and mixed vegetables"
      />
      <p className="text-xs text-muted-foreground">
        Foods in our food table are matched directly. Anything else may be estimated by AI, if it&apos;s set up on this server. You&apos;ll review everything before saving.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="button" onClick={analyze} disabled={busy || text.trim().length === 0}>
        {busy ? <><Loader2 className="animate-spin" /> Analysing…</> : "Analyse meal"}
      </Button>
    </div>
  );
}

/* ------------------------------- Voice ------------------------------ */

interface SRResultItem { transcript: string }
interface SRResult { isFinal: boolean; 0: SRResultItem }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SRErrorEvent { error: string }
interface SpeechRecognitionLike {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SRCtor = new () => SpeechRecognitionLike;

function getSR(): SRCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
const noopSubscribe = () => () => {};

const SPEECH_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access was blocked. Allow it in your browser's site settings, or type what you ate below.",
  "service-not-allowed": "Speech recognition isn't allowed in this browser. You can type what you ate below.",
  "no-speech": "We didn't hear anything. Tap the microphone and try again.",
  "audio-capture": "No microphone was found. You can type what you ate below.",
  network: "Speech recognition needs an internet connection. You can type what you ate below.",
};

function VoiceTab({ onDone }: { onDone: Done }) {
  const supported = useSyncExternalStore(noopSubscribe, () => getSR() !== null, () => false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const baseRef = useRef("");

  useEffect(() => () => recRef.current?.abort(), []);

  function start() {
    const SR = getSR();
    if (!SR) return;
    setError(null);
    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = transcript ? `${transcript.trim()} ` : "";
    rec.onresult = (e) => {
      let finals = "";
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals += `${r[0].transcript} `;
        else interim += r[0].transcript;
      }
      setTranscript((baseRef.current + finals + interim).replace(/\s+/g, " ").trimStart());
    };
    rec.onerror = (e) => {
      setError(SPEECH_ERRORS[e.error] ?? "Speech recognition stopped unexpectedly. You can type what you ate below.");
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Couldn't start the microphone. You can type what you ate below.");
    }
  }

  function stop() {
    recRef.current?.stop();
    setListening(false);
  }

  async function analyze() {
    if (listening) stop();
    setError(null);
    setBusy(true);
    try {
      const r = await postAnalysis("/api/food/analyze-voice", JSON.stringify({ transcript }));
      onDone(r, { method: "voice", originalInput: transcript.trim(), imagePath: null });
    } catch (e) {
      setError(e instanceof AnalysisError ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {supported ? (
        <div className="flex items-center gap-3">
          <Button type="button" size="lg" variant={listening ? "destructive" : "soft"} onClick={listening ? stop : start} aria-pressed={listening}>
            {listening ? <><Square /> Stop</> : <><Mic /> {transcript ? "Keep talking" : "Tap and speak"}</>}
          </Button>
          <p className="text-sm text-muted-foreground" aria-live="polite">{listening ? "Listening… say what you ate." : "Speak naturally, e.g. “two rotis and a bowl of dal”."}</p>
        </div>
      ) : (
        <Notice tone="info">This browser doesn&apos;t support speech recognition (Chrome and Edge do). You can type what you ate below instead.</Notice>
      )}
      <label className="text-sm font-medium" htmlFor="voice-transcript">Transcript (edit if it misheard)</label>
      <Textarea id="voice-transcript" value={transcript} maxLength={1000} onChange={(e) => setTranscript(e.target.value)} placeholder="Your words appear here" />
      <p className="text-xs text-muted-foreground">
        Step 1 turns your voice into text using your browser&apos;s speech service. Step 2, after you press Analyse, finds nutrition for those words. The microphone itself doesn&apos;t measure nutrition.
      </p>
      {error && <Notice tone="error">{error}</Notice>}
      <Button type="button" onClick={analyze} disabled={busy || transcript.trim().length === 0}>
        {busy ? <><Loader2 className="animate-spin" /> Analysing…</> : "Analyse transcript"}
      </Button>
    </div>
  );
}

/* ------------------------------- Photo ------------------------------ */

const MAX_UPLOAD = 5 * 1024 * 1024;

function PhotoTab({ onDone }: { onDone: Done }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState<"idle" | "preparing" | "analysing">("idle");
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  // Revoke the object URL when it changes or the tab unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError({ message: "Please choose an image file." });
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function analyze() {
    if (!file) return;
    setError(null);
    setBusy("preparing");
    try {
      const blob = await resizeImage(file);
      if (blob.size > MAX_UPLOAD) {
        setError({ message: "That photo is still too large after shrinking. Try a different one." });
        return;
      }
      setBusy("analysing");
      const form = new FormData();
      form.append("image", blob, "meal.jpg");
      if (hint.trim()) form.append("hint", hint.trim());
      const r = await postAnalysis("/api/food/analyze-image", form, false);
      onDone(r, { method: "photo", originalInput: hint.trim() || null, imagePath: r.image_path ?? null });
    } catch (e) {
      setError(e instanceof AnalysisError ? { message: e.message, code: e.code } : { message: "Something went wrong." });
    } finally {
      setBusy("idle");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob URL preview, not optimisable
        <img src={preview} alt="Preview of your meal" className="max-h-64 w-full rounded-xl border border-border object-cover" />
      ) : (
        <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">No photo chosen yet</div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="soft"><label className="cursor-pointer"><Camera /> Take photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        </label></Button>
        <Button asChild variant="outline"><label className="cursor-pointer"><ImagePlus /> Upload
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        </label></Button>
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="photo-hint">What&apos;s in it? (optional)</label>
        <Input id="photo-hint" maxLength={200} value={hint} onChange={(e) => setHint(e.target.value)} placeholder="e.g. homemade, cooked in 1 tsp oil" />
      </div>
      <p className="text-xs text-muted-foreground">
        Your photo is shrunk, then sent to an AI service to estimate foods and portions. Photos can&apos;t show oil, sugar or hidden ingredients, so these are rough estimates you can correct.
      </p>
      {error && (
        <Notice tone={error.code === "ai_not_configured" ? "warn" : "error"} title={error.code === "ai_not_configured" ? "Photo analysis isn't set up" : undefined}>
          {error.message}
        </Notice>
      )}
      <Button type="button" onClick={analyze} disabled={!file || busy !== "idle"}>
        {busy === "idle" ? "Analyse photo" : <><Loader2 className="animate-spin" /> {busy === "preparing" ? "Preparing photo…" : "Analysing…"}</>}
      </Button>
    </div>
  );
}
