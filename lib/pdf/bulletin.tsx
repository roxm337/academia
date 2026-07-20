// See lib/pdf/fonts.ts for why this module is not marked server-only.
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { registerAmiri } from "@/lib/pdf/fonts";
import { rtl } from "@/lib/pdf/bidi";

export type BulletinSubject = {
  name: string; // already localized
  coefficient: number;
  average: number | null;
  appreciation?: string | null;
};

export type BulletinInput = {
  locale: string;
  schoolName: string;
  student: { name: string; codeMassar: string };
  className: string;
  yearLabel: string;
  semesterLabel: string;
  subjects: BulletinSubject[];
  general: number | null;
  mention: string; // localized label ("" if none)
  rank: number | null;
  classSize: number;
  stats: { average: number | null; min: number | null; max: number | null };
  /** Conseil de classe, localized by the caller; omitted while a semester is open. */
  councilDecision?: string | null;
  directorAppreciation?: string | null;
  labels: {
    bulletin: string;
    subject: string;
    coefficient: string;
    average: string;
    appreciation: string;
    generalAverage: string;
    rank: string;
    mention: string;
    classAverage: string;
    min: string;
    max: string;
    notGraded: string;
    of: string; // "sur" / "من" — for rank "3 / 30"
    councilDecision: string;
    directorAppreciation: string;
  };
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 9 },
  school: { fontSize: 12, fontWeight: "bold", textAlign: "center" },
  title: { fontSize: 11, fontWeight: "bold", textAlign: "center", marginTop: 2, marginBottom: 10 },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  metaCell: { fontSize: 9 },
  row: { flexDirection: "row" },
  hCell: {
    borderWidth: 0.5, borderColor: "#888", padding: 4,
    backgroundColor: "#eee", fontWeight: "bold",
  },
  cell: { borderWidth: 0.5, borderColor: "#888", padding: 4 },
  cSubject: { flex: 3 },
  cCoef: { flex: 1, textAlign: "center" },
  cAvg: { flex: 1, textAlign: "center" },
  cAppr: { flex: 3 },
  summary: { marginTop: 12, flexDirection: "row", justifyContent: "space-between" },
  bigAvg: { fontSize: 12, fontWeight: "bold" },
  muted: { color: "#666" },
  council: {
    marginTop: 14, paddingTop: 8,
    borderTopWidth: 0.5, borderTopColor: "#888",
  },
  councilLine: { marginBottom: 3 },
});

/**
 * One student's bulletin as a single page.
 *
 * Shared by the single-bulletin route and the whole-class booklet so the two
 * can never drift into printing different layouts for the same school.
 */
function BulletinPage({ input }: { input: BulletinInput }) {
  const isAr = input.locale === "ar";
  const tx = (s: string) => (isAr && s ? rtl(s) : s);
  const L = input.labels;
  const fmt = (n: number | null) => (n === null ? L.notGraded : n.toFixed(2));
  const align = isAr ? ("right" as const) : ("left" as const);

  return (
      <Page
        size="A4"
        style={[styles.page, { fontFamily: isAr ? "Amiri" : "Helvetica", textAlign: align }]}
      >
        <Text style={styles.school}>{tx(input.schoolName)}</Text>
        <Text style={styles.title}>
          {tx(L.bulletin)} — {tx(input.semesterLabel)} {input.yearLabel}
        </Text>

        <View style={styles.meta}>
          <Text style={styles.metaCell}>{tx(input.student.name)}</Text>
          <Text style={styles.metaCell}>{input.student.codeMassar}</Text>
          <Text style={styles.metaCell}>{tx(input.className)}</Text>
        </View>

        {/* header row */}
        <View style={styles.row}>
          <Text style={[styles.hCell, styles.cSubject]}>{tx(L.subject)}</Text>
          <Text style={[styles.hCell, styles.cCoef]}>{tx(L.coefficient)}</Text>
          <Text style={[styles.hCell, styles.cAvg]}>{tx(L.average)}</Text>
          <Text style={[styles.hCell, styles.cAppr]}>{tx(L.appreciation)}</Text>
        </View>

        {input.subjects.map((s, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.cell, styles.cSubject]}>{tx(s.name)}</Text>
            <Text style={[styles.cell, styles.cCoef]}>{s.coefficient}</Text>
            <Text style={[styles.cell, styles.cAvg]}>{fmt(s.average)}</Text>
            <Text style={[styles.cell, styles.cAppr]}>{tx(s.appreciation ?? "")}</Text>
          </View>
        ))}

        <View style={styles.summary}>
          <View>
            <Text style={styles.bigAvg}>
              {tx(L.generalAverage)}: {fmt(input.general)} / 20
            </Text>
            {input.mention ? (
              <Text>{tx(L.mention)}: {tx(input.mention)}</Text>
            ) : null}
            <Text>
              {tx(L.rank)}: {input.rank ?? "—"} {tx(L.of)} {input.classSize}
            </Text>
          </View>
          <View style={styles.muted}>
            <Text>{tx(L.classAverage)}: {fmt(input.stats.average)}</Text>
            <Text>{tx(L.max)}: {fmt(input.stats.max)}</Text>
            <Text>{tx(L.min)}: {fmt(input.stats.min)}</Text>
          </View>
        </View>

        {/* Conseil de classe — only present once the semester is archived. */}
        {input.councilDecision || input.directorAppreciation ? (
          <View style={styles.council}>
            {input.councilDecision ? (
              <Text style={styles.councilLine}>
                {tx(L.councilDecision)}: {tx(input.councilDecision)}
              </Text>
            ) : null}
            {input.directorAppreciation ? (
              <Text style={styles.councilLine}>
                {tx(L.directorAppreciation)}: {tx(input.directorAppreciation)}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Page>
  );
}

/** A single student's bulletin. */
export async function renderBulletinPdf(input: BulletinInput): Promise<Uint8Array> {
  registerAmiri();
  return renderToBuffer(
    <Document>
      <BulletinPage input={input} />
    </Document>,
  );
}

/**
 * Every bulletin for a class in one document, one page each.
 *
 * A school prints a whole class at a time; downloading thirty PDFs and
 * collating them by hand is the actual end-of-semester job this replaces.
 * Order is the caller's — normally by rank — because that is the order the
 * printed stack gets handed out in.
 */
export async function renderBulletinBooklet(inputs: BulletinInput[]): Promise<Uint8Array> {
  registerAmiri();
  return renderToBuffer(
    <Document>
      {inputs.map((input, i) => (
        <BulletinPage key={i} input={input} />
      ))}
    </Document>,
  );
}
