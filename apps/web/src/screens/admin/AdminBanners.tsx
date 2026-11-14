import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { BannerUpsert } from "@coaching-app/shared/schema";
import { ConfirmSheet, Field, Segmented } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminBanner, AdminBatchRow } from "../../lib/adminTypes";
import { errorText, pick } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type Draft = {
  id: string | null;
  imageUrl: string;
  titleBn: string;
  titleEn: string;
  batchId: string;
  linkUrl: string;
  orderIndex: string;
  status: "active" | "inactive";
};

const EMPTY: Draft = { id: null, imageUrl: "", titleBn: "", titleEn: "", batchId: "", linkUrl: "", orderIndex: "0", status: "active" };

const toDraft = (b: AdminBanner): Draft => ({
  id: b.id,
  imageUrl: b.image_url,
  titleBn: b.title_bn,
  titleEn: b.title_en,
  batchId: b.batch_id ?? "",
  linkUrl: b.link_url ?? "",
  orderIndex: String(b.order_index),
  status: b.status,
});

export function AdminBanners() {
  const list = useLoad(() => api<AdminBanner[]>("/api/admin/banners"));
  const batches = useLoad(() => api<AdminBatchRow[]>("/api/admin/batches"));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<AdminBanner | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setDraft(null);
    setDeleting(null);
    setErrors({});
    setFailure(null);
  };

  async function save() {
    if (!draft) return;
    const parsed = BannerUpsert.safeParse({
      imageUrl: draft.imageUrl.trim(),
      titleBn: draft.titleBn,
      titleEn: draft.titleEn,
      batchId: draft.batchId || null,
      linkUrl: draft.linkUrl.trim() || undefined,
      orderIndex: Number.parseInt(draft.orderIndex, 10) || 0,
      status: draft.status,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      if (draft.id) await api(`/api/admin/banners/${draft.id}`, { method: "PUT", body: parsed.data });
      else await api("/api/admin/banners", { body: parsed.data });
      close();
      await list.reload();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/admin/banners/${deleting.id}`, { method: "DELETE" });
      close();
      await list.reload();
    } catch (e) {
      setFailure(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setBusy(false);
  }

  const patch = (changes: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...changes } : current));
  const problem = (key: string) => errors[key]?.[0];

  return (
    <div class="stack">
      <div class="row-between">
        <h1 class="title">{t("admin_tab_banners")}</h1>
        <button class="btn primary" onClick={() => setDraft(EMPTY)}>
          {t("admin_new_banner")}
        </button>
      </div>

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("admin_no_banners")}</p>}

      <div class="list">
        {(list.data ?? []).map((banner) => (
          <button class="item" key={banner.id} onClick={() => setDraft(toDraft(banner))}>
            <span class="name">{pick(banner, "title")}</span>
            <span class="meta">
              {t("admin_order", { n: banner.order_index })}
              {banner.batch_id ? ` · ${banner.batch_id}` : ""}
            </span>
            <span class="side">
              <span class={banner.status === "active" ? "badge mark" : "badge"}>
                {t(banner.status === "active" ? "admin_active" : "admin_inactive")}
              </span>
            </span>
          </button>
        ))}
      </div>

      {draft && !deleting && (
        <Sheet onClose={busy ? undefined : close}>
          <h2 class="subtitle">{draft.id ? t("admin_edit_banner") : t("admin_new_banner")}</h2>
          <div class="stack">
            <Field id="b-image" label={t("admin_banner_image_url")} error={problem("imageUrl")}>
              <input id="b-image" class="input" type="url" value={draft.imageUrl} onInput={(e) => patch({ imageUrl: e.currentTarget.value })} />
            </Field>
            {draft.imageUrl && <img src={draft.imageUrl} alt="" style="width:100%;border:1px solid var(--line)" />}
            <Field id="b-title-en" label={t("admin_title_en")} error={problem("titleEn")}>
              <input id="b-title-en" class="input" value={draft.titleEn} onInput={(e) => patch({ titleEn: e.currentTarget.value })} />
            </Field>
            <Field id="b-title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
              <input id="b-title-bn" class="input" value={draft.titleBn} onInput={(e) => patch({ titleBn: e.currentTarget.value })} />
            </Field>
            <Field id="b-link" label={t("admin_banner_link")} error={problem("linkUrl")}>
              <input id="b-link" class="input" type="url" value={draft.linkUrl} onInput={(e) => patch({ linkUrl: e.currentTarget.value })} />
            </Field>
            <Field id="b-batch" label={t("admin_audience")}>
              <Select
                id="b-batch"
                value={draft.batchId}
                onChange={(batchId) => patch({ batchId })}
                options={[
                  { value: "", label: t("select_none") },
                  ...(batches.data ?? []).map((b) => ({ value: b.id, label: pick(b, "title") })),
                ]}
              />
            </Field>
            <Field id="b-order" label={t("admin_order_index")} error={problem("orderIndex")}>
              <input
                id="b-order"
                class="input"
                inputMode="numeric"
                value={draft.orderIndex}
                onInput={(e) => patch({ orderIndex: e.currentTarget.value.replace(/[^0-9]/g, "") })}
              />
            </Field>
            <Field label={t("admin_visibility")}>
              <Segmented
                label={t("admin_visibility")}
                value={draft.status}
                onChange={(status) => patch({ status })}
                options={[
                  { id: "active", label: t("admin_active") },
                  { id: "inactive", label: t("admin_inactive") },
                ]}
              />
            </Field>
            {failure && <p class="error-text">{failure}</p>}
            <button class="btn primary block" onClick={save} disabled={busy}>
              {t("save")}
            </button>
            {draft.id && (
              <button
                class="btn danger block"
                disabled={busy}
                onClick={() => setDeleting(list.data?.find((b) => b.id === draft.id) ?? null)}
              >
                {t("admin_delete")}
              </button>
            )}
            <button class="btn quiet block" onClick={close} disabled={busy}>
              {t("cancel")}
            </button>
          </div>
        </Sheet>
      )}

      {deleting && (
        <ConfirmSheet
          title={t("admin_delete_banner_title")}
          body={t("admin_delete_banner_body")}
          confirmLabel={t("admin_delete")}
          danger
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
