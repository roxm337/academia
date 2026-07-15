import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Prisma's client and the pg driver must stay external to the server bundle.
  // @react-pdf/renderer (fontkit + node streams) is bundler-hostile — keep it
  // external so PDF generation runs against the real package on the server.
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "@react-pdf/renderer"],
  // A stray lockfile in ~/projets makes Turbopack infer the wrong workspace root.
  turbopack: { root: __dirname },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default withNextIntl(nextConfig);
