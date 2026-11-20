type Db = D1Database;

// Who may open a batch's learning content: anyone for a free published batch,
// otherwise a student with a current enrolment. Archived batches are for
// enrolled students only.
export async function canOpenBatch(db: Db, uid: string, batchId: string): Promise<"ok" | "not_found" | "not_enrolled"> {
  const batch = await db
    .prepare("SELECT kind, status FROM batches WHERE id = ? AND status IN ('published', 'archived')")
    .bind(batchId)
    .first<{ kind: string; status: string }>();
  if (!batch) return "not_found";
  if (batch.kind === "free" && batch.status === "published") return "ok";

  const enrolled = await db
    .prepare("SELECT 1 FROM enrollments WHERE uid = ? AND batch_id = ? AND (expires_at IS NULL OR expires_at > unixepoch())")
    .bind(uid, batchId)
    .first();
  if (enrolled) return "ok";
  return batch.status === "archived" ? "not_found" : "not_enrolled";
}
