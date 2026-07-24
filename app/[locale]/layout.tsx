import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic, IBM_Plex_Mono } from "next/font/google";
import { routing, dirOf } from "@/i18n/routing";
import { getBrand } from "@/lib/school";
import "../globals.css";

/**
 * One superfamily across both scripts.
 *
 * Latin and Arabic were drawn together for Plex, so a multilingual interface does
 * not read as two applications stapled together — the weights, the x-height
 * relationship and the rhythm carry across when a user switches locale. Plex
 * also ships true tabular figures, which is what makes a column of /20 marks
 * scannable.
 */
const latin = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
  display: "swap",
});
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});
/** Codes, times and receipt numbers — things that are read character by character. */
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: t("appName"),
    icons: {
      // SVG first so the tab icon stays crisp at any density; the PNG is the
      // fallback for anything that will not take an SVG favicon. Both carry
      // their own navy plate — the old icon was the white-on-transparent
      // wordmark, which disappeared entirely on a light browser tab.
      icon: [
        { url: "/brand/favicon.svg", type: "image/svg+xml" },
        { url: "/brand/apple-icon.png", type: "image/png", sizes: "180x180" },
      ],
      // Safari does not accept SVG here, so this must stay a PNG.
      apple: "/brand/apple-icon.png",
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const brand = await getBrand();

  return (
    <html
      lang={locale}
      dir={dirOf(locale)}
      className={`${latin.variable} ${arabic.variable} ${mono.variable} h-full`}
      style={
        {
          "--brand": brand.primaryColor,
          "--accent": brand.secondaryColor,
        } as React.CSSProperties
      }
    >
      <body className="min-h-full antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
