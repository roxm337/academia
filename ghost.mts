import "dotenv/config";
import { prisma } from "./lib/prisma";
const u = await prisma.user.findFirst({ where: { email: "eleve1@planetemontessori.demo" }, select: { passwordHash: true } });
const g = await prisma.user.create({ data: { email: "stale-repro@t.test", passwordHash: u!.passwordHash, role: "STUDENT", firstNameAr: "أ", lastNameAr: "ب", firstNameFr: "S", lastNameFr: "T" } });
console.log(g.id);
await prisma.$disconnect();
