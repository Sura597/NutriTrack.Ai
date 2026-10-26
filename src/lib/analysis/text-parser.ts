import { ALL_UNITS } from "@/lib/nutrition/units";

export interface ParsedSegment {
  raw: string;
  /** Number of units (or servings when `unit` is null). */
  quantity: number;
  /** One of ALL_UNITS, or null when the user gave a bare count ("2 rotis"). */
  unit: string | null;
  name: string;
  /** True when the user gave no quantity at all, so we defaulted to one serving. */
  quantityAssumed: boolean;
}

const NUMBER_WORDS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, quarter: 0.25, couple: 2,
};

const UNIT_ALIASES: Record<string, string> = {
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", gr: "g",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  ml: "ml", mls: "ml", millilitre: "ml", milliliter: "ml", millilitres: "ml", milliliters: "ml",
  l: "l", litre: "l", liter: "l", litres: "l", liters: "l", ltr: "l",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", no: "piece", nos: "piece",
  cup: "cup", cups: "cup",
  bowl: "bowl", bowls: "bowl",
  katori: "katori", katoris: "katori", vati: "katori", vatis: "katori",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp", tbs: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  slice: "slice", slices: "slice",
  glass: "glass", glasses: "glass",
  plate: "plate", plates: "plate",
};

export function normalizeUnitToken(token: string): string | null {
  const u = UNIT_ALIASES[token.toLowerCase().replace(/\.$/, "")];
  return u && (ALL_UNITS as readonly string[]).includes(u) ? u : null;
}

const FILLER_PREFIX =
  /^(?:(?:i|we)\s+)?(?:had|ate|eaten|have|having|took|drank|consumed|for\s+(?:breakfast|lunch|dinner|snacks?)|about|around|approx(?:imately)?|roughly|some|little|a\s+little|a\s+bit\s+of)\b[:,]?\s*/i;

function parseNumber(token: string): number | null {
  const t = token.toLowerCase();
  if (/^\d+(?:\.\d+)?$/.test(t)) return Number(t);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  if (t in NUMBER_WORDS) return NUMBER_WORDS[t];
  return null;
}

/** Split free text into food segments and pull out quantity, unit and name for each. */
export function parseMealText(text: string): ParsedSegment[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[&+]/g, ",")
    .replace(/\s+(?:and|with|plus|along\s+with)\s+/g, ",")
    .replace(/[;\n]+/g, ",");
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);

  const out: ParsedSegment[] = [];
  for (const raw of parts) {
    let s = raw.replace(FILLER_PREFIX, "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    if (!s) continue;

    let quantity: number | null = null;
    let unit: string | null = null;

    // "1 1/2 cups rice" / "2.5 cups rice" / "two rotis" / "half cup curd" / "200g paneer" / "2x roti"
    const tokens = s.replace(/(\d)([a-z])/g, "$1 $2").replace(/(\d)x\b/g, "$1").split(" ");
    let i = 0;
    if (tokens[0] === "a" && tokens[1] === "couple") {
      quantity = 2;
      i = 2;
    } else {
      const first = parseNumber(tokens[0] ?? "");
      if (first !== null) {
        quantity = first;
        i = 1;
        // mixed number: "1 1/2"
        const second = tokens[1] ? tokens[1].match(/^(\d+)\/(\d+)$/) : null;
        if (second && Number(second[2]) !== 0) {
          quantity += Number(second[1]) / Number(second[2]);
          i = 2;
        }
      }
    }

    if (quantity !== null) {
      const u = tokens[i] ? normalizeUnitToken(tokens[i]) : null;
      if (u) {
        unit = u;
        i += 1;
      }
      if (tokens[i] === "of") i += 1;
    } else {
      // trailing form: "rice 1 cup", "milk 200 ml"
      const m = s.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*([a-z]+)?$/);
      if (m) {
        const u = m[3] ? normalizeUnitToken(m[3]) : null;
        if (u || !m[3]) {
          quantity = Number(m[2]);
          unit = u;
          s = m[1];
          tokens.length = 0;
          tokens.push(...s.split(" "));
          i = 0;
        }
      }
    }

    const name = tokens.slice(i).join(" ").replace(/^of\s+/, "").replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();
    if (!name) continue;

    out.push({
      raw,
      quantity: quantity !== null && quantity > 0 ? quantity : 1,
      unit,
      name,
      quantityAssumed: quantity === null,
    });
  }
  return out;
}

/** Candidate search terms for a name: as typed, then simple singular forms. */
export function nameVariants(name: string): string[] {
  const variants = new Set<string>([name]);
  const words = name.split(" ");
  const last = words[words.length - 1];
  const stem = (w: string) =>
    w.endsWith("ies") ? `${w.slice(0, -3)}y`
    : w.endsWith("oes") ? w.slice(0, -2)
    : w.endsWith("es") && /(?:ch|sh|x|s)es$/.test(w) ? w.slice(0, -2)
    : w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1)
    : w;
  const singular = stem(last);
  if (singular !== last) variants.add([...words.slice(0, -1), singular].join(" "));
  // "rotis" -> "roti", but also "chapatis" -> "chapati"
  return [...variants];
}
