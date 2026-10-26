import { authed, ok, ApiError } from "@/lib/api";
import { analyzeMealImage } from "@/lib/analysis/pipeline";
import { getAiProvider } from "@/lib/ai/provider";
import { makeQuotaConsumer } from "@/lib/ai/quota";
import { foodImageBucket, maxUploadBytes } from "@/lib/env";
import { loadSettings } from "@/lib/data/profile";
import { detectImageType } from "@/lib/image-type";

export const maxDuration = 60;

export const POST = authed(async ({ supabase, user, req }) => {
  // Fail early (before reading the body) when there is nothing to analyse with.
  const provider = getAiProvider();
  if (!provider || !provider.supportsVision) {
    throw new ApiError(503, "ai_not_configured", "Photo analysis needs an AI vision model, which isn't set up on this server. You can still log by typing, speaking or searching foods.");
  }

  const limit = maxUploadBytes();
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > limit + 64 * 1024) throw new ApiError(413, "image_too_large", `That photo is too large. The limit is ${Math.round(limit / 1024 / 1024)} MB.`);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "invalid_form", "Send the photo as multipart form data in a field called \"image\".");
  }
  const file = form.get("image");
  if (!(file instanceof File)) throw new ApiError(400, "missing_image", "Choose a photo to analyse.");
  if (file.size === 0) throw new ApiError(400, "empty_image", "That file is empty.");
  if (file.size > limit) throw new ApiError(413, "image_too_large", `That photo is too large. The limit is ${Math.round(limit / 1024 / 1024)} MB.`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = detectImageType(bytes); // trust the file's bytes, not the client-supplied type
  if (!type) throw new ApiError(415, "unsupported_image", "Please upload a JPEG, PNG or WebP photo.");

  const hintRaw = form.get("hint");
  const hint = typeof hintRaw === "string" ? hintRaw.trim().slice(0, 200) : undefined;

  // Store the photo only if the user allows it. We upload before analysis so a saved meal can reference it.
  const settings = await loadSettings(supabase, user.id);
  const store = settings.privacy_preferences?.store_food_images !== false;
  let imagePath: string | null = null;
  const notes: string[] = [];
  if (store) {
    const path = `${user.id}/${crypto.randomUUID()}.${type.ext}`;
    const { error } = await supabase.storage.from(foodImageBucket()).upload(path, bytes, { contentType: type.mime, upsert: false });
    if (error) {
      console.error("[storage] upload failed");
      notes.push("We couldn't store your photo, but the analysis will still work.");
    } else imagePath = path;
  }

  try {
    const base64 = Buffer.from(bytes).toString("base64");
    const result = await analyzeMealImage(
      { supabase, provider, consumeAiQuota: makeQuotaConsumer(supabase, "analyze-image") },
      { mediaType: type.mime, base64 },
      hint,
    );
    return ok({ ...result, notes: [...notes, ...result.notes], image_path: imagePath, image_stored: !!imagePath });
  } catch (e) {
    // Don't leave an orphaned photo behind when analysis fails.
    if (imagePath) await supabase.storage.from(foodImageBucket()).remove([imagePath]);
    throw e;
  }
});
