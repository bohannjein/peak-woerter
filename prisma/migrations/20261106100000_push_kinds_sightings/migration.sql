-- Push for more events (per-kind opt-out) and Belege (sightings) for words.
ALTER TABLE "user" ADD COLUMN "pushOff" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "notification" ADD COLUMN "kind" TEXT,
ADD COLUMN "pushedAt" TIMESTAMP(3);
-- Existing messages are old news: never push them.
UPDATE "notification" SET "pushedAt" = "createdAt";
CREATE INDEX "notification_pushedAt_createdAt_idx" ON "notification"("pushedAt", "createdAt");

-- CreateTable
CREATE TABLE "sighting" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "saidOn" DATE NOT NULL,
    "occasion" TEXT NOT NULL,
    "saidBy" TEXT,
    "quote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sighting_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sighting_wordId_saidOn_idx" ON "sighting"("wordId", "saidOn");
ALTER TABLE "sighting" ADD CONSTRAINT "sighting_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sighting" ADD CONSTRAINT "sighting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
