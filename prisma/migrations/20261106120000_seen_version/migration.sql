-- "Was ist neu": the last version each person has seen. Everyone who has an
-- account now was on 1.1.3, so they get the 1.2.0 news once.
ALTER TABLE "user" ADD COLUMN "seenVersion" TEXT;
UPDATE "user" SET "seenVersion" = '1.1.3';
