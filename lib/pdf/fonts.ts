// Shared Amiri registration for @react-pdf. NOT marked server-only for the same
// reason as lib/pdf/timetable.tsx — @react-pdf needs the client React build and
// is externalized, never bundled to the browser.
import path from "node:path";
import { Font } from "@react-pdf/renderer";

let done = false;

/** Register Amiri (regular + bold) once. Safe to call repeatedly. */
export function registerAmiri() {
  if (done) return;
  const dir = path.join(process.cwd(), "assets", "fonts");
  Font.register({
    family: "Amiri",
    fonts: [
      { src: path.join(dir, "Amiri-Regular.ttf") },
      { src: path.join(dir, "Amiri-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
  done = true;
}
