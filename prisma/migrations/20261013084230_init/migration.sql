-- CreateEnum
CREATE TYPE "AccessLinkKind" AS ENUM ('INVITE', 'RESET');

-- CreateEnum
CREATE TYPE "WordStatus" AS ENUM ('VOTING', 'LATER', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PartOfSpeech" AS ENUM ('SUBSTANTIV', 'VERB', 'ADJEKTIV', 'ADVERB', 'INTERJEKTION', 'REDEWENDUNG', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "WordSource" AS ENUM ('CURATOR', 'GUEST');

-- CreateEnum
CREATE TYPE "RoundKind" AS ENUM ('INITIAL', 'REVOTE', 'REVIEW');

-- CreateEnum
CREATE TYPE "VoteValue" AS ENUM ('YES', 'NO', 'LATER');

-- CreateEnum
CREATE TYPE "RoundOutcome" AS ENUM ('ACCEPTED', 'LATER', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('NEW', 'FORWARDED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AiDraftStatus" AS ENUM ('DRAFT', 'APPLIED', 'DISCARDED');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "twoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN DEFAULT true,
    "failedVerificationCount" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "twoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,

    CONSTRAINT "passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curator_seat" (
    "seat" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curator_seat_pkey" PRIMARY KEY ("seat")
);

-- CreateTable
CREATE TABLE "access_link" (
    "id" TEXT NOT NULL,
    "kind" "AccessLinkKind" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT,
    "grantAdmin" BOOLEAN NOT NULL DEFAULT false,
    "grantSeat" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "WordStatus" NOT NULL DEFAULT 'VOTING',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "cardNumber" INTEGER,
    "partOfSpeech" "PartOfSpeech",
    "grammar" TEXT,
    "usage" TEXT,
    "origin" TEXT,
    "variants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submissionNote" TEXT,
    "source" "WordSource" NOT NULL DEFAULT 'CURATOR',
    "submittedById" TEXT,
    "guestName" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "word_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "definition" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pronunciation" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "ipa" TEXT NOT NULL,
    "label" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "audioPath" TEXT,

    CONSTRAINT "pronunciation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "example" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "example_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'ink',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "word_category" (
    "wordId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "word_category_pkey" PRIMARY KEY ("wordId","categoryId")
);

-- CreateTable
CREATE TABLE "voting_round" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "kind" "RoundKind" NOT NULL,
    "openedById" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "outcome" "RoundOutcome",

    CONSTRAINT "voting_round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "value" "VoteValue" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "roundId" TEXT,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "note" TEXT,
    "guestName" TEXT,
    "ipHash" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'NEW',
    "wordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_word" (
    "day" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "pickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_word_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "ai_draft" (
    "id" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "content" JSONB NOT NULL,
    "status" "AiDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "twoFactor_secret_idx" ON "twoFactor"("secret");

-- CreateIndex
CREATE INDEX "twoFactor_userId_idx" ON "twoFactor"("userId");

-- CreateIndex
CREATE INDEX "passkey_userId_idx" ON "passkey"("userId");

-- CreateIndex
CREATE INDEX "passkey_credentialID_idx" ON "passkey"("credentialID");

-- CreateIndex
CREATE UNIQUE INDEX "curator_seat_userId_key" ON "curator_seat"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "access_link_tokenHash_key" ON "access_link"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "word_normalized_key" ON "word"("normalized");

-- CreateIndex
CREATE UNIQUE INDEX "word_slug_key" ON "word"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "word_cardNumber_key" ON "word"("cardNumber");

-- CreateIndex
CREATE INDEX "word_status_idx" ON "word"("status");

-- CreateIndex
CREATE INDEX "word_isPublic_term_idx" ON "word"("isPublic", "term");

-- CreateIndex
CREATE INDEX "word_isPublic_acceptedAt_idx" ON "word"("isPublic", "acceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "definition_wordId_position_key" ON "definition"("wordId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "pronunciation_wordId_position_key" ON "pronunciation"("wordId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "example_wordId_position_key" ON "example"("wordId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "category_name_key" ON "category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "category_slug_key" ON "category"("slug");

-- CreateIndex
CREATE INDEX "word_category_categoryId_idx" ON "word_category"("categoryId");

-- CreateIndex
CREATE INDEX "voting_round_closedAt_idx" ON "voting_round"("closedAt");

-- CreateIndex
CREATE UNIQUE INDEX "voting_round_wordId_number_key" ON "voting_round"("wordId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "vote_roundId_seat_key" ON "vote"("roundId", "seat");

-- CreateIndex
CREATE UNIQUE INDEX "vote_roundId_userId_key" ON "vote"("roundId", "userId");

-- CreateIndex
CREATE INDEX "comment_wordId_createdAt_idx" ON "comment"("wordId", "createdAt");

-- CreateIndex
CREATE INDEX "submission_status_createdAt_idx" ON "submission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "submission_normalized_idx" ON "submission"("normalized");

-- CreateIndex
CREATE INDEX "daily_word_wordId_idx" ON "daily_word"("wordId");

-- CreateIndex
CREATE INDEX "ai_draft_wordId_status_idx" ON "ai_draft"("wordId", "status");

-- CreateIndex
CREATE INDEX "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "twoFactor" ADD CONSTRAINT "twoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curator_seat" ADD CONSTRAINT "curator_seat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_link" ADD CONSTRAINT "access_link_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word" ADD CONSTRAINT "word_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "definition" ADD CONSTRAINT "definition_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pronunciation" ADD CONSTRAINT "pronunciation_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "example" ADD CONSTRAINT "example_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_category" ADD CONSTRAINT "word_category_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_category" ADD CONSTRAINT "word_category_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voting_round" ADD CONSTRAINT "voting_round_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voting_round" ADD CONSTRAINT "voting_round_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote" ADD CONSTRAINT "vote_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "voting_round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote" ADD CONSTRAINT "vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "voting_round"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission" ADD CONSTRAINT "submission_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_word" ADD CONSTRAINT "daily_word_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_draft" ADD CONSTRAINT "ai_draft_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "word"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ───────── Hand-written constraints (not expressible in Prisma schema) ─────────

-- Exactly two curator seats.
ALTER TABLE "curator_seat" ADD CONSTRAINT "curator_seat_seat_check" CHECK ("seat" IN (1, 2));
ALTER TABLE "vote" ADD CONSTRAINT "vote_seat_check" CHECK ("seat" IN (1, 2));
ALTER TABLE "access_link" ADD CONSTRAINT "access_link_seat_check" CHECK ("grantSeat" IS NULL OR "grantSeat" IN (1, 2));

-- At most one open voting round per word.
CREATE UNIQUE INDEX "voting_round_one_open_per_word" ON "voting_round" ("wordId") WHERE "closedAt" IS NULL;

-- A closed round always has an outcome and vice versa.
ALTER TABLE "voting_round" ADD CONSTRAINT "voting_round_closed_outcome_check"
  CHECK (("closedAt" IS NULL) = ("outcome" IS NULL));

-- Only accepted words may be public.
ALTER TABLE "word" ADD CONSTRAINT "word_public_check" CHECK (NOT "isPublic" OR "status" = 'ACCEPTED');
