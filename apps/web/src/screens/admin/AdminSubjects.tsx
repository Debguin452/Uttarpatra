import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { SubjectUpsert } from "@coaching-app/shared/schema";
import { Field } from "../../components/adminUi";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminSubject } from "../../lib/adminTypes";
import { errorText, pick } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type Draft = { isNew: boolean; id: string; nameBn: string; nameEn: string; active: boolean; sortOrder: string };

const NEW_DRAFT: Draft = { isNew: true, id: "", nameBn: "", nameEn: "", active: true, sortOrder: "200" };

export function AdminSubjects() {
  const list = useLoad(() => api<AdminSubject[]>("/api/admin/subjects"));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setDraft(null);
    setErrors({});
    setFailure(null);
  };

  const patch = (changes: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...changes } : current));
  const problem = (key: string) => errors[key]?.[0];

  async function save() {
    if (!draft) return;
    const parsed = SubjectUpsert.safeParse({
      id: draft.id.trim(),
      nameBn: draft.nameBn,
      nameEn: draft.nameEn,
      active: draft.active,
      sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      if (draft.isNew) await api("/api/admin/subjects", { body: parsed.data });
      else {
        const { id, ...rest } = parsed.data;
        await api(`/api/admin/subjects/${id}`, { method: "PUT", body: rest });
      }
      close();
      await list.reload();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  return (
    <div class="stack">
      <div class="row-between">
        <h1 class="title">{t("admin_tab_subjects")}</h1>
        <button class="btn primary" onClick={() => setDraft(NEW_DRAFT)}>
          {t("admin_new_subject")}
        </button>
      </div>
      <p class="muted small">{t("admin_subjects_intro")}</p>

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}

      <div class="list">
        {(list.data ?? []).map((subject) => (
          <button
            class="item"
            key={subject.id}
            onClick={() =>
              setDraft({
                isNew: false,
                id: subject.id,
                nameBn: subject.name_bn,
                nameEn: subject.name_en,
                active: Boolean(subject.active),
                sortOrder: String(subject.sort_order),
              })
            }
          >
            <span class="name">{pick(subject, "name")}</span>
            <span class="meta">
              {subject.id} · {t("admin_subject_assignments", { count: subject.assignment_count })}
            </span>
            <span class="side">
              <span class={subject.active ? "badge mark" : "badge"}>{subject.active ? t("admin_active") : t("admin_inactive")}</span>
            </span>
          </button>
        ))}
      </div>

      {draft && (
        <Sheet onClose={busy ? undefined : close}>
          <h2 class="subtitle">{draft.isNew ? t("admin_new_subject") : t("admin_edit_subject")}</h2>
          <div class="stack">
            <Field
              id="s-id"
              label={t("admin_subject_id")}
              hint={draft.isNew ? t("admin_subject_id_hint") : undefined}
              error={problem("id")}
            >
              <input
                id="s-id"
                class="input"
                value={draft.id}
                disabled={!draft.isNew}
                onInput={(e) => patch({ id: e.currentTarget.value.toLowerCase() })}
              />
            </Field>
            <Field id="s-en" label={t("admin_title_en")} error={problem("nameEn")}>
              <input id="s-en" class="input" value={draft.nameEn} onInput={(e) => patch({ nameEn: e.currentTarget.value })} />
            </Field>
            <Field id="s-bn" label={t("admin_title_bn")} error={problem("nameBn")}>
              <input id="s-bn" class="input" value={draft.nameBn} onInput={(e) => patch({ nameBn: e.currentTarget.value })} />
            </Field>
            <Field id="s-order" label={t("admin_sort_order")}>
              <input
                id="s-order"
                class="input"
                inputMode="numeric"
                value={draft.sortOrder}
                onInput={(e) => patch({ sortOrder: e.currentTarget.value.replace(/[^0-9]/g, "") })}
              />
            </Field>
            <label class="check">
              <input type="checkbox" checked={draft.active} onChange={(e) => patch({ active: e.currentTarget.checked })} />
              <span>{t("admin_subject_active")}</span>
            </label>
            {failure && <p class="error-text">{failure}</p>}
            <button class="btn primary block" onClick={save} disabled={busy}>
              {t("save")}
            </button>
            <button class="btn quiet block" onClick={close} disabled={busy}>
              {t("cancel")}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
