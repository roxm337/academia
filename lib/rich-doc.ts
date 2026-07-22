/**
 * Converts converter-produced HTML into a tree the reader can render safely.
 *
 * The threat is real and boring: a .docx is an untrusted file. Anyone who can
 * attach one — a teacher today, and whoever gets hold of a teacher account —
 * controls the text that ends up on a student's screen. A hyperlink in Word can
 * carry a `javascript:` target, and a converter faithfully passes it through.
 *
 * Two decisions make this defensible:
 *
 *  1. It REBUILDS rather than strips. Nothing from the input is ever copied to
 *     the output verbatim. Unknown tags do not get "removed" — they are simply
 *     never constructed, and their text survives as escaped text. A regex that
 *     deletes `<script>` can be beaten by `<scr<script>ipt>`; a parser that only
 *     ever emits tags it recognises cannot.
 *
 *  2. The output is DATA, not markup — `RichNode`, which React renders as real
 *     elements. There is no `dangerouslySetInnerHTML` anywhere in the reader, so
 *     even a bug in this file yields wrong-looking text rather than script
 *     execution. Text is escaped by React, by construction.
 *
 * Pure and client-safe: the tests exercise exactly what the page renders.
 */

export type RichNode =
  | { kind: "text"; text: string }
  | { kind: "element"; tag: AllowedTag; attrs: Record<string, string>; children: RichNode[] };

/**
 * What a course document is allowed to be made of. Everything a Word file
 * legitimately produces, and nothing that executes, loads, or frames anything.
 *
 * Absent on purpose: script, style, iframe, object, embed, form, input, svg,
 * link, meta, base. `style` matters as much as `script` — CSS can position an
 * invisible overlay over the page it is embedded in.
 */
const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "sub", "sup",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "table", "thead", "tbody", "tr", "td", "th",
  "a", "img", "hr",
] as const;

export type AllowedTag = (typeof ALLOWED_TAGS)[number];

const TAG_SET = new Set<string>(ALLOWED_TAGS);
const VOID_TAGS = new Set(["br", "img", "hr"]);

/** Attributes kept per tag. Anything else — including every on* handler — is dropped. */
const ALLOWED_ATTRS: Partial<Record<AllowedTag, readonly string[]>> = {
  a: ["href"],
  img: ["src", "alt"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
};

/**
 * Remove the characters a browser ignores when it resolves a URL scheme, so
 * "java\tscript:" and "  JAVASCRIPT:" cannot slip past a prefix comparison.
 */
function stripIgnorable(s: string): string {
  return s.replace(/[\u0000-\u0020]/g, "");
}

/**
 * A link target we are willing to render.
 *
 * Allowlist, never a blocklist: `javascript:` is the one everybody remembers,
 * but `data:text/html`, `vbscript:` and `blob:` all execute too. Anything not
 * recognised as http/https/mailto or a same-document anchor is dropped, and the
 * link degrades to plain text rather than becoming a trap.
 */
function safeHref(raw: string): string | null {
  // Strip the characters browsers ignore when resolving a scheme, so
  // "java\tscript:" and "  JaVaScRiPt:" cannot slip past the comparison.
  const collapsed = stripIgnorable(raw).toLowerCase();
  if (collapsed.startsWith("http://")) return raw.trim();
  if (collapsed.startsWith("https://")) return raw.trim();
  if (collapsed.startsWith("mailto:")) return raw.trim();
  if (collapsed.startsWith("#")) return raw.trim();
  return null;
}

/**
 * An image source we are willing to render.
 *
 * Converters inline document images as base64 data URIs, which is exactly what
 * we want — the picture travels with the text, no second request, no extra
 * upload. Restricted to real raster types: `data:image/svg+xml` is a document,
 * not a picture, and it can carry script.
 */
function safeSrc(raw: string): string | null {
  const collapsed = stripIgnorable(raw).toLowerCase();
  if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(collapsed)) return raw.trim();
  if (collapsed.startsWith("https://")) return raw.trim();
  return null;
}

/**
 * Named entities worth decoding.
 *
 * The structural five, plus the Latin-1 letters and the punctuation Word likes
 * to insert. A French handout is full of `&eacute;` and `&agrave;`; leaving
 * those literal puts "d&eacute;riv&eacute;e" on a student's screen. Arabic
 * arrives as numeric references, handled separately below.
 */
const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  nbsp: "\u00a0", laquo: "\u00ab", raquo: "\u00bb", deg: "\u00b0", euro: "\u20ac",
  hellip: "\u2026", mdash: "\u2014", ndash: "\u2013", middot: "\u00b7",
  times: "\u00d7", divide: "\u00f7",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201c", rdquo: "\u201d",
  agrave: "\u00e0", aacute: "\u00e1", acirc: "\u00e2", atilde: "\u00e3",
  auml: "\u00e4", aring: "\u00e5", aelig: "\u00e6", ccedil: "\u00e7",
  egrave: "\u00e8", eacute: "\u00e9", ecirc: "\u00ea", euml: "\u00eb",
  igrave: "\u00ec", iacute: "\u00ed", icirc: "\u00ee", iuml: "\u00ef",
  ntilde: "\u00f1", ograve: "\u00f2", oacute: "\u00f3", ocirc: "\u00f4",
  otilde: "\u00f5", ouml: "\u00f6", oslash: "\u00f8", ugrave: "\u00f9",
  uacute: "\u00fa", ucirc: "\u00fb", uuml: "\u00fc", yuml: "\u00ff",
  szlig: "\u00df",
  Agrave: "\u00c0", Aacute: "\u00c1", Acirc: "\u00c2", Auml: "\u00c4",
  AElig: "\u00c6", Ccedil: "\u00c7", Egrave: "\u00c8", Eacute: "\u00c9",
  Ecirc: "\u00ca", Euml: "\u00cb", Icirc: "\u00ce", Iuml: "\u00cf",
  Ocirc: "\u00d4", Ouml: "\u00d6", Ugrave: "\u00d9", Ucirc: "\u00db",
  Uuml: "\u00dc",
};

/** Decode the entities a converter emits. Text is re-escaped by React on render. */
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      // Lone surrogates and out-of-range values would throw; keep them literal.
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      if (code >= 0xd800 && code <= 0xdfff) return whole;
      return String.fromCodePoint(code);
    }
    return ENTITIES[body] ?? ENTITIES[body.toLowerCase()] ?? whole;
  });
}

type Token =
  | { t: "text"; value: string }
  | { t: "open"; name: string; attrs: Record<string, string>; selfClosing: boolean }
  | { t: "close"; name: string };

/**
 * Minimal HTML tokenizer.
 *
 * Only recognises what a document converter produces. Anything it cannot parse
 * as a tag it yields as text, which is the safe direction to fail: an
 * unparseable `<` becomes a literal "<" on the page.
 */
function tokenize(html: string): Token[] {
  const out: Token[] = [];
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out.push({ t: "text", value: html.slice(i) });
      break;
    }
    if (lt > i) out.push({ t: "text", value: html.slice(i, lt) });

    // Comments and doctypes carry nothing we render; skip the whole construct
    // rather than letting "<!--" leak through as text.
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
      const end = html.indexOf(">", lt);
      i = end === -1 ? html.length : end + 1;
      continue;
    }

    const closing = html[lt + 1] === "/";
    const nameStart = lt + (closing ? 2 : 1);
    const nameMatch = /^[a-zA-Z][a-zA-Z0-9]*/.exec(html.slice(nameStart));
    if (!nameMatch) {
      // Not a tag at all — a bare "<" in the prose.
      out.push({ t: "text", value: "<" });
      i = lt + 1;
      continue;
    }
    const name = nameMatch[0].toLowerCase();
    let j = nameStart + nameMatch[0].length;

    if (closing) {
      const gt = html.indexOf(">", j);
      out.push({ t: "close", name });
      i = gt === -1 ? html.length : gt + 1;
      continue;
    }

    // Attributes, up to the tag's ">".
    const attrs: Record<string, string> = {};
    let selfClosing = false;
    while (j < html.length) {
      while (j < html.length && /\s/.test(html[j])) j++;
      if (html[j] === ">") { j++; break; }
      if (html[j] === "/" && html[j + 1] === ">") { selfClosing = true; j += 2; break; }

      const attrName = /^[^\s=/>]+/.exec(html.slice(j));
      if (!attrName) { j++; continue; }
      const key = attrName[0].toLowerCase();
      j += attrName[0].length;

      while (j < html.length && /\s/.test(html[j])) j++;
      let value = "";
      if (html[j] === "=") {
        j++;
        while (j < html.length && /\s/.test(html[j])) j++;
        const quote = html[j];
        if (quote === '"' || quote === "'") {
          const end = html.indexOf(quote, j + 1);
          value = end === -1 ? html.slice(j + 1) : html.slice(j + 1, end);
          j = end === -1 ? html.length : end + 1;
        } else {
          const unquoted = /^[^\s>]*/.exec(html.slice(j))![0];
          value = unquoted;
          j += unquoted.length;
        }
      }
      attrs[key] = decodeEntities(value);
    }

    out.push({ t: "open", name, attrs, selfClosing });
    i = j;
  }

  return out;
}

/** Keep only the attributes this tag is allowed, with values we have vetted. */
function cleanAttrs(tag: AllowedTag, raw: Record<string, string>): Record<string, string> | null {
  const allowed = ALLOWED_ATTRS[tag];
  const out: Record<string, string> = {};
  if (!allowed) return out;

  for (const key of allowed) {
    const value = raw[key];
    if (value === undefined) continue;

    if (tag === "a" && key === "href") {
      const href = safeHref(value);
      // A link we will not follow becomes plain text: keeping the <a> with no
      // href would render something that looks clickable and silently is not.
      if (!href) return null;
      out.href = href;
      continue;
    }
    if (tag === "img" && key === "src") {
      const src = safeSrc(value);
      if (!src) return null;
      out.src = src;
      continue;
    }
    if (key === "colspan" || key === "rowspan") {
      // Numbers only, and bounded: a colspan of 100000 is a layout attack.
      const n = parseInt(value, 10);
      if (Number.isFinite(n) && n > 1 && n <= 100) out[key] = String(n);
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Parse converter HTML into a safe tree.
 *
 * Unknown tags are unwrapped, not dropped — their children still render, so a
 * `<span>` around a sentence does not delete the sentence.
 */
export function parseRichDoc(html: string): RichNode[] {
  if (!html) return [];

  const root: RichNode[] = [];
  // Only elements we actually emit go on the stack; unwrapped tags never do, so
  // their closing tag simply finds nothing to close and is ignored.
  const stack: Array<{ tag: AllowedTag; node: Extract<RichNode, { kind: "element" }> }> = [];
  const push = (node: RichNode) => {
    const top = stack[stack.length - 1];
    (top ? top.node.children : root).push(node);
  };

  for (const token of tokenize(html)) {
    if (token.t === "text") {
      const text = decodeEntities(token.value);
      if (text) push({ kind: "text", text });
      continue;
    }

    if (token.t === "open") {
      if (!TAG_SET.has(token.name)) continue; // unwrap: children still render
      const tag = token.name as AllowedTag;
      const attrs = cleanAttrs(tag, token.attrs);
      if (attrs === null) continue; // vetoed by its own attributes (bad href/src)

      const node: Extract<RichNode, { kind: "element" }> = {
        kind: "element", tag, attrs, children: [],
      };
      push(node);
      if (!VOID_TAGS.has(tag) && !token.selfClosing) stack.push({ tag, node });
      continue;
    }

    // close
    if (!TAG_SET.has(token.name)) continue;
    for (let k = stack.length - 1; k >= 0; k--) {
      if (stack[k].tag === token.name) {
        // Unclosed inner tags are closed with it, so crossed markup like
        // <b><i></b></i> cannot leave the stack permanently unbalanced.
        stack.length = k;
        break;
      }
    }
  }

  return root;
}

/** Is there anything worth showing? Whitespace-only conversions should not open a reader. */
export function hasContent(nodes: RichNode[]): boolean {
  return nodes.some((n) =>
    n.kind === "text" ? n.text.trim().length > 0 : n.tag === "img" || hasContent(n.children),
  );
}
