import { and, eq } from "drizzle-orm";
import { db, ownerState, type OwnerState } from "@workspace/db";

export type StateWriteResult =
  | { kind: "updated"; state: OwnerState }
  | { kind: "conflict"; actualRevision?: number };

export async function getOwnerState(ownerId: string): Promise<OwnerState | undefined> {
  const [state] = await db.select().from(ownerState).where(eq(ownerState.ownerId, ownerId));
  return state;
}

/**
 * Creates revision 1 only when expectedRevision is zero, otherwise performs a
 * compare-and-swap update. No read-modify-write window is exposed to callers.
 */
export async function writeOwnerState(
  ownerId: string,
  snapshot: unknown,
  expectedRevision: number,
): Promise<StateWriteResult> {
  if (expectedRevision === 0) {
    const [created] = await db
      .insert(ownerState)
      .values({ ownerId, snapshot, revision: 1 })
      .onConflictDoNothing()
      .returning();
    if (created) return { kind: "updated", state: created };
  }

  const [updated] = await db
    .update(ownerState)
    .set({ snapshot, revision: expectedRevision + 1, updatedAt: new Date() })
    .where(and(eq(ownerState.ownerId, ownerId), eq(ownerState.revision, expectedRevision)))
    .returning();
  if (updated) return { kind: "updated", state: updated };

  const current = await getOwnerState(ownerId);
  return { kind: "conflict", actualRevision: current?.revision };
}