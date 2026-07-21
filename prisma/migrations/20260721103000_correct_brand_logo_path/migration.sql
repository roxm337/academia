-- Corrects the logo written by 20260720143000_planete_montessori_rebrand.
--
-- That migration was edited after it had already been applied, which is why
-- this one exists: an applied migration is immutable — its checksum is stored
-- in _prisma_migrations, and rewriting the file silently splits the schema of
-- databases that ran the old text from those that ran the new. The correction
-- belongs in a new migration, so every database converges no matter which
-- version it applied.
--
-- Scoped to the stale value so it is idempotent and cannot clobber a logo the
-- school has since uploaded through Settings.

UPDATE "SchoolSettings"
SET "logoPath" = '/planete-montessori-private-school-marrakech-Frame-11.png'
WHERE "logoPath" = '/brand/planete-montessori-logo.png';
