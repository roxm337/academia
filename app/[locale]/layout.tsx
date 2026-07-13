import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Geist } from "next/font/google";
import { Cairo } from "next/font/google";
import { routing, dirOf } from "@/i18n/routing";
import { getBrand } from "@/lib/school";
import "../globals.css";

const latin = Geist({ subsets: ["latin"], variable: "--font-latin" });
const arabic = Cairo({ subsets: ["arabic"], variable: "--font-arabic" });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return { title: t("appName") };
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
      className={`${latin.variable} ${arabic.variable} h-full`}
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
