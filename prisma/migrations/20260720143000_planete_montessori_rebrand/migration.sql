ALTER TABLE "SchoolSettings"
  ALTER COLUMN "primaryColor" SET DEFAULT '#133562',
  ALTER COLUMN "secondaryColor" SET DEFAULT '#ef5b4e';

UPDATE "SchoolSettings"
SET
  "nameAr" = 'مدرسة بلانيت مونتيسوري الدولية',
  "nameFr" = 'Planète Montessori International School',
  "logoPath" = '/planete-montessori-private-school-marrakech-Frame-11.png',
  "primaryColor" = '#133562',
  "secondaryColor" = '#ef5b4e',
  "addressAr" = 'تجزئة أمين رقم 8، تاركة، مراكش',
  "addressFr" = 'Lotissement Amine, n°8, Targa, Marrakech',
  "phone" = '+212 6 62 63 24 03',
  "email" = 'planetemontessori@gmail.com'
WHERE "id" = 1;

UPDATE "User"
SET "email" = regexp_replace("email", '@eleve\.academia\.ma$', '@eleve.planetemontessori.demo')
WHERE "email" LIKE '%@eleve.academia.ma';

UPDATE "User"
SET "email" = regexp_replace("email", '@academia\.ma$', '@planetemontessori.demo')
WHERE "email" LIKE '%@academia.ma';

UPDATE "Guardian"
SET "email" = regexp_replace("email", '@academia\.ma$', '@planetemontessori.demo')
WHERE "email" LIKE '%@academia.ma';

UPDATE "FeeSchedule"
SET "discountNote" = 'Bourse Planète Montessori'
WHERE "discountNote" = 'Bourse Academia';

UPDATE "Announcement"
SET
  "bodyFr" = replace("bodyFr", 'Academia', 'Planète Montessori'),
  "bodyAr" = replace("bodyAr", 'أكاديميا', 'بلانيت مونتيسوري')
WHERE "bodyFr" LIKE '%Academia%' OR "bodyAr" LIKE '%أكاديميا%';
