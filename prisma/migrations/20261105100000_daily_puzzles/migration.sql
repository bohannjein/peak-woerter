-- Daily puzzles (Wortjagd, Quartett, Echt oder erfunden, Buchstaben-Sudoku)
-- and web push subscriptions for the 10:00 reminder.
ALTER TABLE "game_round" ADD COLUMN "puzzle" JSONB;

-- CreateTable
CREATE TABLE "game_play" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "won" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_play_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_play_roundId_userId_key" ON "game_play"("roundId", "userId");
CREATE INDEX "game_play_userId_finished_idx" ON "game_play"("userId", "finished");
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");
CREATE INDEX "push_subscription_userId_idx" ON "push_subscription"("userId");

ALTER TABLE "game_play" ADD CONSTRAINT "game_play_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "game_round"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "game_play" ADD CONSTRAINT "game_play_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
