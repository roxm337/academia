// Point the transport at a local sink BEFORE anything reads the environment.
// The real provider is never contacted, so running this sends no mail to anyone.
process.env.SMTP_HOST = "127.0.0.1";
process.env.SMTP_PORT = "2526";
process.env.SMTP_USER = "";
process.env.SMTP_FROM = "ecole@example.test";
process.env.APP_URL = "https://ecole.example.test";

import "dotenv/config";

import net from "node:net";
import { prisma } from "../lib/prisma";
import { notify } from "../lib/notifications";

/**
 * Verifies the EMAIL channel end-to-end against a throwaway SMTP server.
 *
 * Checks the parts that are easy to get wrong and stay invisible until a
 * parent complains: that an Arabic-reading guardian gets an RTL document in
 * Arabic, a French-reading one gets French, links are absolute, and a refused
 * delivery is recorded FAILED rather than quietly SENT.
 *
 * Run: npx tsx --conditions=react-server scripts/acceptance-email.mts
 */

const PORT = 2526;

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(ok ? `  ok   ${name}` : `  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) pass++;
  else fail++;
};

/** Minimal SMTP sink — just enough protocol for nodemailer to finish a send. */
function sink(opts: { reject?: boolean } = {}) {
  const messages: string[] = [];
  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    let inData = false;
    let buffer = "";
    socket.write("220 localhost test\r\n");
    socket.on("data", (chunk) => {
      const text = chunk.toString();
      if (inData) {
        buffer += text;
        if (buffer.includes("\r\n.\r\n")) {
          inData = false;
          messages.push(buffer);
          buffer = "";
          socket.write("250 OK queued\r\n");
        }
        return;
      }
      const cmd = text.toUpperCase();
      if (cmd.startsWith("EHLO") || cmd.startsWith("HELO")) {
        socket.write("250-localhost\r\n250 SIZE 10485760\r\n");
      } else if (cmd.startsWith("MAIL FROM")) {
        socket.write(opts.reject ? "550 sender rejected\r\n" : "250 OK\r\n");
      } else if (cmd.startsWith("RCPT TO")) {
        socket.write(opts.reject ? "550 no such mailbox\r\n" : "250 OK\r\n");
      } else if (cmd.startsWith("DATA")) {
        inData = true;
        socket.write("354 send data\r\n");
      } else if (cmd.startsWith("QUIT")) {
        socket.write("221 bye\r\n");
        socket.end();
      } else {
        socket.write("250 OK\r\n");
      }
    });
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
  });
  const start = () =>
    new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
  const stop = () =>
    new Promise<void>((resolve) => {
      for (const s of sockets) s.destroy();
      server.close(() => resolve());
    });
  return { messages, start, stop };
}

/** Undo nodemailer's transfer encoding so the body can be asserted on. */
function decode(raw: string): string {
  const b64 = [...raw.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)(?=\r\n--)/g)]
    .map((m) => Buffer.from(m[1].replace(/\r\n/g, ""), "base64").toString("utf8"))
    .join("\n");
  const qp = raw
    .replace(/=\r\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return `${b64}\n${qp}`;
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "parent1@planetemontessori.demo" } });
  if (!user) throw new Error("seed missing: parent1@planetemontessori.demo");
  const originalLocale = user.locale;
  const created: string[] = [];

  const send = async (locale: string) => {
    await prisma.user.update({ where: { id: user.id }, data: { locale } });
    const rows = await notify({
      userId: user.id,
      type: "ACCEPTANCE_TEST",
      titleAr: "تنبيه غياب",
      titleFr: "Alerte d'absence",
      bodyAr: "تغيب ابنكم اليوم عن الحصة.",
      bodyFr: "Votre enfant a ete absent aujourd'hui.",
      link: "/parent/attendance",
      channels: ["IN_APP", "EMAIL"],
    });
    created.push(...rows.map((r) => r.id));
    return rows;
  };

  const good = sink();
  await good.start();

  console.log("\n== delivery ==");
  const arRows = await send("ar");
  const inApp = arRows.find((r) => r.channel === "IN_APP");
  const email = arRows.find((r) => r.channel === "EMAIL");
  check("one row per requested channel", arRows.length === 2, `got ${arRows.length}`);
  check("in-app row is SENT", inApp?.status === "SENT");
  check("email row is SENT", email?.status === "SENT", `status=${email?.status} err=${email?.error}`);
  check("sentAt is stamped", Boolean(email?.sentAt));
  check("the SMTP server received a message", good.messages.length === 1);

  console.log("\n== an Arabic recipient gets an Arabic, RTL message ==");
  const ar = decode(good.messages[0] ?? "");
  check('document is dir="rtl"', ar.includes('dir="rtl"'));
  check('document is lang="ar"', ar.includes('lang="ar"'));
  check("body is the Arabic translation", ar.includes("تغيب ابنكم اليوم"));
  check("the French translation is absent", !ar.includes("Votre enfant a ete absent"));
  check(
    "link is absolute and locale-prefixed",
    ar.includes("https://ecole.example.test/ar/parent/attendance"),
  );

  console.log("\n== a French recipient gets a French, LTR message ==");
  await send("fr");
  const fr = decode(good.messages[1] ?? "");
  check('document is dir="ltr"', fr.includes('dir="ltr"'));
  check("body is the French translation", fr.includes("Votre enfant a ete absent"));
  check("the Arabic translation is absent", !fr.includes("تغيب ابنكم"));
  check(
    "link uses the French locale prefix",
    fr.includes("https://ecole.example.test/fr/parent/attendance"),
  );

  await good.stop();

  console.log("\n== a refused delivery is recorded, never faked ==");
  const bad = sink({ reject: true });
  await bad.start();
  const failRows = await notify({
    userId: user.id,
    type: "ACCEPTANCE_TEST",
    titleAr: "ت",
    titleFr: "t",
    bodyAr: "ب",
    bodyFr: "b",
    channels: ["EMAIL"],
  });
  created.push(...failRows.map((r) => r.id));
  const rejected = failRows[0];
  check("a rejected send is FAILED, not SENT", rejected?.status === "FAILED", `got ${rejected?.status}`);
  check("the failure reason is recorded", Boolean(rejected?.error));
  check("sentAt stays empty on failure", rejected?.sentAt === null);
  await bad.stop();

  await prisma.notification.deleteMany({ where: { id: { in: created } } });
  await prisma.user.update({ where: { id: user.id }, data: { locale: originalLocale } });

  console.log(`\nPASS=${pass} FAIL=${fail}`);
  await prisma.$disconnect();
  // The pooled SMTP transport holds the event loop open; nothing left to do.
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
