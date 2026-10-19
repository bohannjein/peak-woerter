-- CreateEnum
CREATE TYPE "ElectionKind" AS ENUM ('JURY', 'COMMUNITY');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "avatarPath" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "favoriteWordId" TEXT,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "category" ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nsfw" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "word_category" ADD COLUMN     "auto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "voting_round" ADD COLUMN     "deadline" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_access" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT,
    "singleUse" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accessId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election" (
    "id" TEXT NOT NULL,
    "kind" "ElectionKind" NOT NULL,
    "year" INTEGER NOT NULL,
    "nominateFrom" TIMESTAMP(3) NOT NULL,
    "shortlistFrom" TIMESTAMP(3) NOT NULL,
    "finalFrom" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "nominations" INTEGER NOT NULL DEFAULT 3,
    "shortlistVotes" INTEGER NOT NULL DEFAULT 3,
    "finalists" INTEGER NOT NULL DEFAULT 5,
    "winnerWordId" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "election_vote" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "wordId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "election_vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_round" (
    "id" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_entry" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT,
    "audioPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_vote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,

    CONSTRAINT "game_vote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "guest_access_tokenHash_key" ON "guest_access"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "guest_session_tokenHash_key" ON "guest_session"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "election_kind_year_key" ON "election"("kind", "year");

-- CreateIndex
CREATE INDEX "election_vote_electionId_stage_idx" ON "election_vote"("electionId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "election_vote_electionId_stage_wordId_userId_key" ON "election_vote"("electionId", "stage", "wordId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "election_vote_electionId_stage_wordId_guestId_key" ON "election_vote"("electionId", "stage", "wordId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "game_round_game_day_key" ON "game_round"("game", "day");

-- CreateIndex
CREATE UNIQUE INDEX "game_entry_roundId_userId_key" ON "game_entry"("roundId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "game_vote_roundId_voterId_key" ON "game_vote"("roundId", "voterId");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_favoriteWordId_fkey" FOREIGN KEY ("favoriteWordId") REFERENCES "word"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_access" ADD CONSTRAINT "guest_access_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_session" ADD CONSTRAINT "guest_session_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "guest_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election" ADD CONSTRAINT "election_winnerWordId_fkey" FOREIGN KEY ("winnerWordId") REFERENCES "word"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guest_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_round" ADD CONSTRAINT "game_round_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_entry" ADD CONSTRAINT "game_entry_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "game_round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_entry" ADD CONSTRAINT "game_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_vote" ADD CONSTRAINT "game_vote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "game_round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_vote" ADD CONSTRAINT "game_vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_vote" ADD CONSTRAINT "game_vote_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "game_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───────── Hand-written constraints ─────────

-- Voter count is now an admin setting: seats are any positive number.
ALTER TABLE "curator_seat" DROP CONSTRAINT "curator_seat_seat_check";
ALTER TABLE "curator_seat" ADD CONSTRAINT "curator_seat_seat_check" CHECK ("seat" >= 1);
ALTER TABLE "vote" DROP CONSTRAINT "vote_seat_check";
ALTER TABLE "vote" ADD CONSTRAINT "vote_seat_check" CHECK ("seat" >= 1);
ALTER TABLE "access_link" DROP CONSTRAINT "access_link_seat_check";
ALTER TABLE "access_link" ADD CONSTRAINT "access_link_seat_check" CHECK ("grantSeat" IS NULL OR "grantSeat" >= 1);

-- An election vote belongs to exactly one member or one guest.
ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_voter_check" CHECK (("userId" IS NULL) <> ("guestId" IS NULL));
ALTER TABLE "election_vote" ADD CONSTRAINT "election_vote_value_check" CHECK ("value" IN (-1, 1) AND "stage" IN (1, 2, 3));
