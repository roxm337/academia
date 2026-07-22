import "dotenv/config";

import { rm } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";
import { prisma } from "../lib/prisma";
import { attachFiles } from "../lib/lesson-attachments";
import { storeUpload } from "../lib/storage";
import { DOCX_MIME, LEGACY_DOC_MIME } from "../lib/upload-accept";
import { hasContent, parseRichDoc, type RichNode } from "../lib/rich-doc";

/**
 * Acceptance — course documents, read in the page.
 *
 * Builds real .docx files (a .docx is a zip of XML) and pushes them through the
 * same `attachFiles` the teacher's form calls, so this exercises conversion,
 * storage and sanitising exactly as production does rather than a stand-in.
 *
 * The one that matters is the hostile document: Word will happily store a
 * `javascript:` hyperlink, and a converter passes it straight through.
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-doc-reader.ts
 */

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};

// ---------------------------------------------------------------- .docx builder

/** Minimal ZIP writer — enough for the three parts a Word file needs. */
function zip(files: Array<{ name: string; body: string }>): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, "utf8");
    const raw = Buffer.from(f.body, "utf8");
    const deflated = deflateRawSync(raw);
    const sum = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0, 10); // time/date
    local.writeUInt32LE(sum, 14);
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, deflated);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt32LE(0, 12);
    cd.writeUInt32LE(sum, 16);
    cd.writeUInt32LE(deflated.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(0, 42);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + deflated.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, centralBuf, end]);
}

/** A .docx whose body is the given WordprocessingML paragraphs. */
function docx(bodyXml: string): Buffer {
  return zip([
    {
      name: "[Content_Types].xml",
      body: `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      body: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    {
      name: "word/_rels/document.xml.rels",
      body: `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rHack" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>`,
    },
    {
      name: "word/document.xml",
      body: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${bodyXml}</w:body></w:document>`,
    },
  ]);
}

const para = (text: string, style?: string) =>
  `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const text = (nodes: RichNode[]): string =>
  nodes.map((n) => (n.kind === "text" ? n.text : text(n.children))).join("");
const tags = (nodes: RichNode[]): string[] =>
  nodes.flatMap((n) => (n.kind === "element" ? [n.tag, ...tags(n.children)] : []));

async function main() {
  const lesson = await prisma.lesson.findFirst({ select: { id: true } });
  const teacher = await prisma.user.findFirst({
    where: { role: "TEACHER" },
    select: { id: true },
  });
  if (!lesson || !teacher) throw new Error("seed a lesson and a teacher first");

  const created: string[] = [];
  const onDisk: string[] = [];
  const root = process.env.STORAGE_LOCAL_DIR ?? "./storage";

  const upload = async (name: string, buf: Buffer, mime: string) => {
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(buf)], name, { type: mime }));
    const err = await attachFiles(fd, lesson.id, teacher.id);
    const row = await prisma.storedFile.findFirst({
      where: { filename: name },
      orderBy: { createdAt: "desc" },
    });
    if (row) {
      created.push(row.id);
      onDisk.push(path.join(root, row.path));
    }
    return { err, row };
  };

  console.log("\n== a Word document becomes readable text ==");
  const normal = docx(
    para("Chapitre 1 : la dérivée", "Heading1") +
      para("La dérivée décrit le taux de variation d'une fonction.") +
      para("Elle s'annule aux extremums."),
  );
  const { err: e1, row: r1 } = await upload("cours.docx", normal, DOCX_MIME);
  check("the .docx is accepted", e1 === null, JSON.stringify(e1));
  check("it is stored with a .docx key", Boolean(r1?.path.endsWith(".docx")), r1?.path);
  check("conversion produced reader HTML", Boolean(r1?.readerHtml), r1?.readerHtml?.slice(0, 60));

  const nodes = parseRichDoc(r1?.readerHtml ?? "");
  check("the prose survives", text(nodes).includes("taux de variation"), text(nodes).slice(0, 80));
  check("the accented characters survive", text(nodes).includes("dérivée"));
  check("the heading became a heading", tags(nodes).includes("h1"), tags(nodes).join(","));
  check("there is something to show", hasContent(nodes));

  console.log("\n== a hostile document is defused, not merely stored ==");
  // A Word hyperlink pointing at javascript:. The converter reproduces it
  // faithfully; the reader is what has to refuse it.
  const hostile = docx(
    `<w:p><w:hyperlink r:id="rHack"><w:r><w:t>Cliquez ici</w:t></w:r></w:hyperlink></w:p>` +
      para("texte après le piège"),
  );
  const { row: r2 } = await upload("piege.docx", hostile, DOCX_MIME);
  const rawHostile = r2?.readerHtml ?? "";
  const hostileNodes = parseRichDoc(rawHostile);

  check(
    "the raw conversion really did contain the attack (else this proves nothing)",
    rawHostile.toLowerCase().includes("javascript:"),
    rawHostile.slice(0, 120),
  );
  check(
    "the rendered tree contains no link at all",
    !tags(hostileNodes).includes("a"),
    tags(hostileNodes).join(","),
  );
  check(
    "no node anywhere carries a javascript: value",
    !JSON.stringify(hostileNodes).toLowerCase().includes("javascript:"),
  );
  check("the words are still readable", text(hostileNodes).includes("Cliquez ici"));
  check("the rest of the document still renders", text(hostileNodes).includes("texte après le piège"));

  console.log("\n== legacy .doc is refused with a useful message ==");
  const legacy = await storeUpload(
    new File([new Uint8Array(Buffer.from("\xd0\xcf\x11\xe0old word", "binary"))], "vieux.doc", {
      type: LEGACY_DOC_MIME,
    }),
    { uploadedById: teacher.id, folder: `lessons/${lesson.id}` },
  );
  check(
    "it is rejected as legacyDoc, not as a generic bad type",
    !legacy.ok && legacy.error === "legacyDoc",
    JSON.stringify(legacy),
  );

  console.log("\n== a PDF is left alone ==");
  const pdfBuf = Buffer.from("%PDF-1.4\n% acceptance\n");
  const { row: r3 } = await upload("fiche.pdf", pdfBuf, "application/pdf");
  check("a PDF gets no reader HTML (it is rendered client-side)", r3?.readerHtml === null, String(r3?.readerHtml));

  // cleanup
  await prisma.lessonAttachment.deleteMany({ where: { fileId: { in: created } } });
  await prisma.storedFile.deleteMany({ where: { id: { in: created } } });
  for (const f of onDisk) await rm(f, { force: true });
  check("test files removed", true);

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
