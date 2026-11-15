import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { CouponUpsert } from "@coaching-app/shared/schema";
import { ConfirmSheet, Field, Segmented } from "../../components/adminUi";
import { Select } from "../../components/Select";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminBatchRow, AdminCoupon } from "../../lib/adminTypes";
import { errorText, pick, when } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type Draft = {
  isNew: boolean;
  code: string;
  discountType: "percent" | "flat";
  discountValue: string;
  maxUses: string;
  validFrom: string;
  validUntil: string;
  batchId: string;
};

const toLocalInput = (unixSec: number | null): string => {
  if (!unixSec) return "";
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toUnixSec = (local: string): number | null => (local ? Math.round(new Date(local).getTime() / 1000) : null);

const EMPTY: Draft = { isNew: true, code: "", discountType: "percent", discountValue: "", maxUses: "", validFrom: "", validUntil: "", batchId: "" };

const toDraft = (c: AdminCoupon): Draft => ({
  isNew: false,
  code: c.code,
  discountType: c.discount_type,
  discountValue: String(c.discount_value),
  maxUses: c.max_uses ? String(c.max_uses) : "",
  validFrom: toLocalInput(c.valid_from),
  validUntil: toLocalInput(c.valid_until),
  batchId: c.batch_id ?? "",
});

export function AdminCoupons() {
  const list = useLoad(() => api<AdminCoupon[]>("/api/admin/coupons"));
  const batches = useLoad(() => api<AdminBatchRow[]>("/api/admin/batches"));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<AdminCoupon | null>(null);
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
    const parsed = CouponUpsert.safeParse({
      code: draft.code,
      discountType: draft.discountType,
      discountValue: Number.parseInt(draft.discountValue, 10),
      maxUses: draft.maxUses ? Number.parseInt(draft.maxUses, 10) : undefined,
      validFrom: toUnixSec(draft.validFrom),
      validUntil: toUnixSec(draft.validUntil),
      batchId: draft.batchId || null,
    });
    if (!parsed.success) {
      setErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      if (draft.isNew) await api("/api/admin/coupons", { body: parsed.data });
      else await api(`/api/admin/coupons/${parsed.data.code}`, { method: "PUT", body: parsed.data });
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
      await api(`/api/admin/coupons/${deleting.code}`, { method: "DELETE" });
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
        <h1 class="title">{t("admin_tab_coupons")}</h1>
        <button class="btn primary" onClick={() => setDraft(EMPTY)}>
          {t("admin_new_coupon")}
        </button>
      </div>

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("admin_no_coupons")}</p>}

      <div class="list">
        {(list.data ?? []).map((coupon) => (
          <button class="item" key={coupon.code} onClick={() => setDraft(toDraft(coupon))}>
            <span class="name">{coupon.code}</span>
            <span class="meta">
              {coupon.discount_type === "percent" ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`} ·{" "}
              {t("admin_coupon_used", { count: coupon.used_count, max: coupon.max_uses ?? "∞" })}
              {coupon.batch_title_en ? ` · ${coupon.batch_title_en}` : ` · ${t("admin_audience_all")}`}
              {coupon.valid_until ? ` · ${t("admin_coupon_until")} ${when(coupon.valid_until)}` : ""}
            </span>
          </button>
        ))}
      </div>

      {draft && !deleting && (
        <Sheet onClose={busy ? undefined : close}>
          <h2 class="subtitle">{draft.isNew ? t("admin_new_coupon") : t("admin_edit_coupon")}</h2>
          <div class="stack">
            <Field id="c-code" label={t("admin_coupon_code")} error={problem("code")}>
              <input
                id="c-code"
                class="input"
                value={draft.code}
                disabled={!draft.isNew}
                onInput={(e) => patch({ code: e.currentTarget.value.toUpperCase() })}
              />
            </Field>
            <Field label={t("admin_coupon_type")}>
              <Segmented
                label={t("admin_coupon_type")}
                value={draft.discountType}
                onChange={(discountType) => patch({ discountType })}
                options={[
                  { id: "percent", label: t("admin_coupon_percent") },
                  { id: "flat", label: t("admin_coupon_flat") },
                ]}
              />
            </Field>
            <Field id="c-value" label={draft.discountType === "percent" ? t("admin_coupon_value_percent") : t("admin_coupon_value_flat")} error={problem("discountValue")}>
              <input
                id="c-value"
                class="input"
                inputMode="numeric"
                value={draft.discountValue}
                onInput={(e) => patch({ discountValue: e.currentTarget.value.replace(/[^0-9]/g, "") })}
              />
            </Field>
            <Field id="c-batch" label={t("admin_audience")}>
              <Select
                id="c-batch"
                value={draft.batchId}
                onChange={(batchId) => patch({ batchId })}
                options={[{ value: "", label: t("admin_audience_all") }, ...(batches.data ?? []).map((b) => ({ value: b.id, label: pick(b, "title") }))]}
              />
            </Field>
            <Field id="c-max" label={t("admin_coupon_max_uses")} hint={t("admin_coupon_max_uses_hint")}>
              <input
                id="c-max"
                class="input"
                inputMode="numeric"
                value={draft.maxUses}
                onInput={(e) => patch({ maxUses: e.currentTarget.value.replace(/[^0-9]/g, "") })}
              />
            </Field>
            <Field id="c-from" label={t("admin_coupon_valid_from")}>
              <input id="c-from" class="input" type="datetime-local" value={draft.validFrom} onInput={(e) => patch({ validFrom: e.currentTarget.value })} />
            </Field>
            <Field id="c-until" label={t("admin_coupon_valid_until")}>
              <input id="c-until" class="input" type="datetime-local" value={draft.validUntil} onInput={(e) => patch({ validUntil: e.currentTarget.value })} />
            </Field>
            {failure && <p class="error-text">{failure}</p>}
            <button class="btn primary block" onClick={save} disabled={busy || !draft.code.trim() || !draft.discountValue}>
              {t("save")}
            </button>
            {!draft.isNew && (
              <button class="btn danger block" disabled={busy} onClick={() => setDeleting(list.data?.find((c) => c.code === draft.code) ?? null)}>
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
          title={t("admin_delete_coupon_title")}
          body={t("admin_delete_coupon_body")}
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
