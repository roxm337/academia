/**
 * Arabic text in @react-pdf/renderer.
 *
 * @react-pdf shapes Arabic glyphs correctly (fontkit runs OpenType joining),
 * but it does NOT apply the Unicode bidirectional algorithm across direction
 * runs. An Arabic paragraph containing a strong-LTR run — a Code Massar
 * (`A123456789`), a Latin subject name, an email — comes out with its Arabic
 * segments reordered. Verified: "التلميذ: أحمد بنعلي — رمز مسار: A123456789"
 * renders with "رمز مسار" leftmost instead of "التلميذ".
 *
 * Wrapping the paragraph in RLE (U+202B) … PDF (U+202C) forces the correct
 * embedding and fixes the ordering. Unicode *isolates* (LRI/PDI) do NOT work
 * here — @react-pdf draws them as visible glyphs.
 *
 * Every Arabic string that reaches a <Text> must go through `rtl()`.
 * Use `bidi(text, locale)` at call sites that render either locale.
 */
const RLE = "‫";
const PDF_ = "‬";

export function rtl(text: string): string {
  if (!text) return text;
  return `${RLE}${text}${PDF_}`;
}

export function bidi(text: string, locale: string): string {
  return locale === "ar" ? rtl(text) : text;
}
