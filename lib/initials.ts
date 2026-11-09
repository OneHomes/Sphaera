// Honorifics/prefixes that would make every avatar read the same letter.
const SKIP = new Set(["mr", "mrs", "ms", "miss", "dr", "engr", "prof", "syed", "sayed", "sayyid"]);
// Most Pakistani names start with one of these; skip only when other words remain.
const SOFT_SKIP = new Set(["muhammad", "mohammad", "muhammed", "mohammed", "m"]);

function firstGrapheme(word: string): string {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const { segment } of seg.segment(word)) return segment;
    return "";
  }
  return Array.from(word)[0] ?? "";
}

/** "Muhammad Ali Khan" -> "AK", "Jo" -> "J". Returns "" for empty input so callers can show an icon. */
export function initials(name: string | null | undefined): string {
  const norm = (w: string) => w.toLowerCase().replace(/\.$/, "");
  let words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  words = words.filter((w) => !SKIP.has(norm(w)));
  const rest = words.filter((w) => !SOFT_SKIP.has(norm(w)));
  if (rest.length > 0) words = rest;
  if (words.length === 0) return "";
  const first = firstGrapheme(words[0]);
  const last = words.length > 1 ? firstGrapheme(words[words.length - 1]) : "";
  return (first + last).toUpperCase();
}
