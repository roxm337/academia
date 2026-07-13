import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7: the datasource URL lives here, not in schema.prisma, and .env is
// no longer auto-loaded — hence the explicit "dotenv/config" import above.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
