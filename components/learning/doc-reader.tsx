import { parseRichDoc, type RichNode } from "@/lib/rich-doc";

/**
 * Renders a converted Word document.
 *
 * Note what is absent: `dangerouslySetInnerHTML`. The document is parsed into a
 * node tree and rebuilt as React elements, so text is escaped by React and no
 * attribute reaches the DOM that `lib/rich-doc.ts` did not construct.
 *
 * A server component, so parsing costs the phone nothing — the student receives
 * finished markup. That matters more than it sounds: this is the same page a
 * parent opens on a five-year-old Android.
 */
export function DocReader({
  html,
  arabic,
}: {
  /** Raw converter output. Sanitised here, on the way out — never before storage. */
  html: string;
  /** Arabic documents need the whole block flipped, not just the font. */
  arabic: boolean;
}) {
  const nodes = parseRichDoc(html);

  return (
    <div
      dir={arabic ? "rtl" : "ltr"}
      lang={arabic ? "ar" : "fr"}
      className="doc-reader text-[0.98rem] leading-8 text-[var(--ink)]"
    >
      {nodes.map((node, i) => (
        <Node key={i} node={node} />
      ))}
    </div>
  );
}

function Node({ node }: { node: RichNode }) {
  if (node.kind === "text") return <>{node.text}</>;

  const children = node.children.map((child, i) => <Node key={i} node={child} />);

  switch (node.tag) {
    case "br":
      return <br />;
    case "hr":
      return <hr className="my-4 border-[var(--line)]" />;
    case "img":
      return (
        /* eslint-disable-next-line @next/next/no-img-element --
           the source is a data URI embedded in the document; next/image cannot
           optimise one and would only add a wrapper around bytes we already hold. */
        <img
          src={node.attrs.src}
          alt={node.attrs.alt ?? ""}
          className="my-3 h-auto max-w-full rounded"
        />
      );
    case "a":
      return (
        // Untrusted destination even after vetting the scheme: noopener stops
        // the target rewriting this tab, and nofollow keeps a compromised
        // document from donating the school's ranking to a spam site.
        <a
          href={node.attrs.href}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-[var(--brand)] underline underline-offset-2"
        >
          {children}
        </a>
      );
    case "table":
      // Wide tables scroll inside themselves; the page must never scroll
      // sideways, which breaks RTL badly.
      return (
        <div className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">{children}</table>
        </div>
      );
    case "td":
      return (
        <td
          colSpan={num(node.attrs.colspan)}
          rowSpan={num(node.attrs.rowspan)}
          className="border border-[var(--line)] px-3 py-2 align-top"
        >
          {children}
        </td>
      );
    case "th":
      return (
        <th
          colSpan={num(node.attrs.colspan)}
          rowSpan={num(node.attrs.rowspan)}
          className="border border-[var(--line)] bg-[var(--surface-sunken)] px-3 py-2 text-start font-medium"
        >
          {children}
        </th>
      );
    case "p":
      return <p className="my-3">{children}</p>;
    case "h1":
      return <h2 className="mt-6 mb-2 text-xl font-semibold">{children}</h2>;
    case "h2":
      return <h3 className="mt-5 mb-2 text-lg font-semibold">{children}</h3>;
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      // Everything below h3 flattens: the page already owns h1, and a document
      // that nests six levels deep should not out-shout the lesson title.
      return <h4 className="mt-4 mb-1.5 font-semibold">{children}</h4>;
    case "ul":
      return <ul className="my-3 list-disc space-y-1 ps-6">{children}</ul>;
    case "ol":
      return <ol className="my-3 list-decimal space-y-1 ps-6">{children}</ol>;
    case "li":
      return <li>{children}</li>;
    case "blockquote":
      return (
        <blockquote className="my-3 border-s-2 border-[var(--rule-strong)] ps-4 text-[var(--ink-2)]">
          {children}
        </blockquote>
      );
    case "pre":
      return (
        <pre className="my-3 overflow-x-auto rounded bg-[var(--surface-sunken)] p-3 text-sm">
          {children}
        </pre>
      );
    case "code":
      return <code className="code rounded bg-[var(--surface-sunken)] px-1">{children}</code>;
    case "strong":
      return <strong className="font-semibold">{children}</strong>;
    case "em":
      return <em>{children}</em>;
    case "u":
      return <u>{children}</u>;
    case "s":
      return <s>{children}</s>;
    case "sub":
      return <sub>{children}</sub>;
    case "sup":
      return <sup>{children}</sup>;
    default:
      return <>{children}</>;
  }
}

function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}
