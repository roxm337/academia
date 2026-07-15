// Not marked `server-only`: @react-pdf/renderer drives react-reconciler, which
// needs the *client* React build — incompatible with the `react-server`
// condition that a `server-only` import implies. It never reaches the browser
// anyway: it is imported solely by the PDF route handler and is listed in
// `serverExternalPackages`, so it is externalized rather than bundled.
import path from "node:path";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  periodIndexFor,
  periodsFor,
  minToLabel,
  WEEKDAYS,
  type TimetableVariant,
  type Weekday,
} from "@/lib/timetable";
import { rtl } from "@/lib/pdf/bidi";

/**
 * Amiri shapes Arabic correctly. Registered once; @react-pdf keeps a global
 * font registry so a second call would just re-add the same faces.
 */
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: "Amiri",
    fonts: [
      { src: path.join(dir, "Amiri-Regular.ttf") },
      { src: path.join(dir, "Amiri-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  // Amiri's own line-break engine trips on the mixed Latin/Arabic we feed it;
  // disable hyphenation so words render whole.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

export type PdfSlot = {
  weekday: Weekday;
  startMin: number;
  endMin: number;
  subject: string;
  secondary: string;
  room: string | null;
};

export type TimetablePdfInput = {
  title: string;
  subtitle: string;
  variant: TimetableVariant;
  locale: string;
  timeLabel: string;
  weekdayLabels: Record<string, string>;
  slots: PdfSlot[];
};

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8 },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 2 },
  subtitle: { fontSize: 9, color: "#555", marginBottom: 12 },
  row: { flexDirection: "row" },
  headCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#999",
    padding: 4,
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
    textAlign: "center",
  },
  timeHead: {
    width: 48,
    borderWidth: 0.5,
    borderColor: "#999",
    padding: 4,
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
    textAlign: "center",
  },
  timeCell: {
    width: 48,
    borderWidth: 0.5,
    borderColor: "#999",
    padding: 3,
    textAlign: "center",
    color: "#555",
  },
  cell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#999",
    padding: 3,
    minHeight: 34,
  },
  subject: { fontWeight: "bold" },
  meta: { color: "#555", fontSize: 7 },
});

/** Renders the class-or-teacher weekly grid to a PDF buffer. */
export async function renderTimetablePdf(
  input: TimetablePdfInput,
): Promise<Uint8Array> {
  registerFonts();

  const isAr = input.locale === "ar";
  const tx = (s: string) => (isAr && s ? rtl(s) : s);
  const periods = periodsFor(input.variant);

  // Under RTL the columns run right-to-left; @react-pdf doesn't reorder them,
  // so reverse the weekday order and let the time column sit on the right.
  const days = isAr ? [...WEEKDAYS].reverse() : WEEKDAYS;

  // grid[periodIndex][weekday] -> slot
  const grid = new Map<string, PdfSlot>();
  for (const s of input.slots) {
    const pi = periodIndexFor(s.startMin, periods);
    if (pi === null) continue;
    grid.set(`${pi}#${s.weekday}`, s);
  }

  const dayHeaders = days.map((d) => (
    <Text key={d} style={styles.headCell}>
      {input.weekdayLabels[d] ?? d}
    </Text>
  ));

  const TimeHead = (
    <Text key="th" style={styles.timeHead}>
      {input.timeLabel}
    </Text>
  );

  const doc = (
    <Document>
      <Page
        size="A4"
        orientation="landscape"
        style={[styles.page, { fontFamily: isAr ? "Amiri" : "Helvetica" }]}
      >
        <Text style={styles.title}>{tx(input.title)}</Text>
        <Text style={styles.subtitle}>{tx(input.subtitle)}</Text>

        <View style={styles.row}>
          {isAr ? [...dayHeaders, TimeHead] : [TimeHead, ...dayHeaders]}
        </View>

        {periods.map((p, pi) => {
          const cells = days.map((d) => {
            const slot = grid.get(`${pi}#${d}`);
            return (
              <View key={d} style={styles.cell}>
                {slot ? (
                  <>
                    <Text style={styles.subject}>{tx(slot.subject)}</Text>
                    <Text style={styles.meta}>{tx(slot.secondary)}</Text>
                    <Text style={styles.meta}>
                      {minToLabel(slot.startMin)}–{minToLabel(slot.endMin)}
                      {slot.room ? ` · ${tx(slot.room)}` : ""}
                    </Text>
                  </>
                ) : null}
              </View>
            );
          });
          const timeCell = (
            <Text key="tc" style={styles.timeCell}>
              {minToLabel(p.startMin)}
              {"\n"}
              {minToLabel(p.endMin)}
            </Text>
          );
          return (
            <View key={pi} style={styles.row}>
              {isAr ? [...cells, timeCell] : [timeCell, ...cells]}
            </View>
          );
        })}
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
