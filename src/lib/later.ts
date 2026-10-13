import { db } from "./db";

/** Words on the Später list with their last decided round and recent comments. */
export function laterWords() {
  return db.word.findMany({
    where: { status: "LATER" },
    orderBy: { updatedAt: "asc" },
    include: {
      rounds: { where: { closedAt: { not: null } }, orderBy: { number: "desc" }, include: { votes: { include: { user: { select: { name: true } } } } } },
      comments: { orderBy: { createdAt: "desc" }, take: 3, include: { user: { select: { name: true } } } },
      _count: { select: { comments: true, rounds: true } },
      definitions: { orderBy: { position: "asc" } },
      pronunciations: { orderBy: { position: "asc" } },
      examples: { orderBy: { position: "asc" } },
      categories: { include: { category: true } },
    },
  });
}
