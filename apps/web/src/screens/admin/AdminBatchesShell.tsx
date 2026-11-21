import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { AdminBatchEditor, AdminBatches } from "./AdminBatches";
import { AdminLectures } from "./AdminLectures";
import { AdminMaterials } from "./AdminMaterials";
import { AdminTests } from "./AdminTests";

type Sub = "batches" | "lectures" | "materials" | "tests";
const SUBS: { id: Sub; label: string }[] = [
  { id: "batches", label: "admin_batches_tab_batches" },
  { id: "lectures", label: "admin_tab_lectures" },
  { id: "materials", label: "admin_tab_materials" },
  { id: "tests", label: "admin_tab_tests" },
];

export function AdminBatchesShell({ batchId }: { batchId?: string }) {
  const [sub, setSub] = useState<Sub>("batches");

  // Editing one batch's own settings/teachers is a focused task, same as
  // before this screens were grouped together — show just the editor.
  if (batchId) return <AdminBatchEditor id={batchId} />;

  return (
    <div class="stack">
      <h1 class="title">{t("admin_tab_batches")}</h1>
      <div class="seg" role="tablist">
        {SUBS.map((entry) => (
          <button role="tab" aria-selected={sub === entry.id} onClick={() => setSub(entry.id)}>
            {t(entry.label)}
          </button>
        ))}
      </div>
      {sub === "batches" && <AdminBatches />}
      {sub === "lectures" && <AdminLectures />}
      {sub === "materials" && <AdminMaterials />}
      {sub === "tests" && <AdminTests />}
    </div>
  );
}
