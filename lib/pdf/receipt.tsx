// See lib/pdf/fonts.ts for why this module is not marked server-only.
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { registerAmiri } from "@/lib/pdf/fonts";
import { rtl } from "@/lib/pdf/bidi";
import { formatMAD } from "@/lib/fees";

export type ReceiptInput = {
  locale: string;
  schoolName: string;
  number: number;
  issuedAt: string;
  student: { name: string; codeMassar: string };
  amount: number;
  method: string; // localized label
  reference: string | null;
  allocations: { label: string; amount: number }[];
  labels: {
    receipt: string; number: string; date: string; student: string;
    amount: string; method: string; reference: string; covers: string; total: string;
  };
};

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10 },
  school: { fontSize: 14, fontWeight: "bold", textAlign: "center" },
  title: { fontSize: 12, fontWeight: "bold", textAlign: "center", marginTop: 4, marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#555" },
  big: { fontSize: 16, fontWeight: "bold", marginTop: 8 },
  section: { marginTop: 14, borderTopWidth: 0.5, borderColor: "#999", paddingTop: 8 },
  line: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
});

export async function renderReceiptPdf(input: ReceiptInput): Promise<Uint8Array> {
  registerAmiri();
  const isAr = input.locale === "ar";
  const tx = (s: string) => (isAr && s ? rtl(s) : s);
  const L = input.labels;
  const align = isAr ? ("right" as const) : ("left" as const);

  return renderToBuffer(
    <Document>
      <Page size="A5" style={[styles.page, { fontFamily: isAr ? "Amiri" : "Helvetica", textAlign: align }]}>
        <Text style={styles.school}>{tx(input.schoolName)}</Text>
        <Text style={styles.title}>{tx(L.receipt)} — {L.number} {input.number}</Text>

        <View style={styles.row}><Text style={styles.label}>{tx(L.date)}</Text><Text>{input.issuedAt}</Text></View>
        <View style={styles.row}><Text style={styles.label}>{tx(L.student)}</Text><Text>{tx(input.student.name)}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Code Massar</Text><Text>{input.student.codeMassar}</Text></View>
        <View style={styles.row}><Text style={styles.label}>{tx(L.method)}</Text><Text>{tx(input.method)}</Text></View>
        {input.reference ? (
          <View style={styles.row}><Text style={styles.label}>{tx(L.reference)}</Text><Text>{input.reference}</Text></View>
        ) : null}

        <Text style={styles.big}>{tx(L.amount)}: {formatMAD(input.amount, input.locale)}</Text>

        {input.allocations.length ? (
          <View style={styles.section}>
            <Text style={{ marginBottom: 4, fontWeight: "bold" }}>{tx(L.covers)}</Text>
            {input.allocations.map((a, i) => (
              <View key={i} style={styles.line}>
                <Text>{tx(a.label)}</Text>
                <Text>{formatMAD(a.amount, input.locale)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Page>
    </Document>,
  );
}
