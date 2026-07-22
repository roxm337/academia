-- In-app reader for course documents.
--
-- Word files are converted to HTML once, at upload. The column holds the
-- converter's raw output: sanitising happens on render, not here, so the rules
-- can be tightened later and every document already uploaded gets the fix.
ALTER TABLE "StoredFile" ADD COLUMN "readerHtml" TEXT;
