/**
 * Normalise a phone number to E.164. A bare 10-digit number is treated as Indian (+91).
 * Returns null when the input can't be a valid number.
 */
export function normalizePhone(input: string, defaultCountry = "+91"): string | null {
  const cleaned = input.replace(/[\s\-().]/g, "");
  if (/^\+\d{8,15}$/.test(cleaned)) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return `${defaultCountry}${cleaned}`;
  if (/^0\d{10}$/.test(cleaned)) return `${defaultCountry}${cleaned.slice(1)}`;
  if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;
  return null;
}

/** Friendly messages for common Supabase Auth errors. Falls back to a generic message. */
export function friendlyAuthError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Check them or reset your password.";
  if (m.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "An account with this email already exists. Try signing in instead.";
  if (m.includes("token has expired") || m.includes("otp_expired") || m.includes("expired"))
    return "That code has expired. Request a new one.";
  if (m.includes("invalid") && (m.includes("token") || m.includes("otp"))) return "That code isn't right. Check it and try again.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Too many attempts. Please wait a minute and try again.";
  if (m.includes("password") && m.includes("characters")) return "Choose a longer password (at least 8 characters).";
  if (m.includes("weak") || (m.includes("password") && m.includes("should contain")))
    return "That password is too easy to guess. Add letters, numbers and a symbol.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Sign-ups are turned off for this app.";
  if (m.includes("unsupported phone provider") || m.includes("sms") || m.includes("phone provider"))
    return "Phone sign-in isn't set up on this server yet. Use email instead.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Couldn't reach the server. Check your connection.";
  return "Something went wrong. Please try again.";
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNextPath(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
