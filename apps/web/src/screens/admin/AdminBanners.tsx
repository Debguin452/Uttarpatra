import { useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { BANNER_TARGETS, BannerUpsert, type BannerTarget } from "@coaching-app/shared/schema";
import { AdminImagePreview } from "../../components/AdminImagePreview";
import { ConfirmSheet, Field, Segmented } from "../../components/adminUi";
import { toLocalInput, toUnixSec } from "../../lib/datetime";
import { imageSrc } from "../../lib/image";
import { Select } from "../../components/Select";
import { Loading, Sheet } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import type { AdminBanner, AdminBatchRow } from "../../lib/adminTypes";
import { errorText, pick } from "../../lib/format";
import { useLoad } from "../../lib/useLoad";

type ButtonDraft = { labelBn: string; labelEn: string; url: string };

type Draft = {
  id: string | null;
  imageUrl: string;
  titleBn: string;
  titleEn: string;
  descriptionBn: string;
  descriptionEn: string;
  targetType: BannerTarget | "";
  targetId: string;
  linkUrl: string;
  cta: "details" | "enroll";
  supportHoursBn: string;
  supportHoursEn: string;
  phone: string;
  buttons: ButtonDraft[];
  startsAt: string;
  endsAt: string;
  orderIndex: string;
  status: "active" | "inactive";
};

const EMPTY: Draft = {
  id: null, imageUrl: "", titleBn: "", titleEn: "", descriptionBn: "", descriptionEn: "", targetType: "", targetId: "", linkUrl: "", cta: "details",
  supportHoursBn: "", supportHoursEn: "", phone: "", buttons: [], startsAt: "", endsAt: "", orderIndex: "0", status: "active",
};

const toDraft = (b: AdminBanner): Draft => ({
  id: b.id,
  imageUrl: b.image_url,
  titleBn: b.title_bn,
  titleEn: b.title_en,
  descriptionBn: b.description_bn ?? "",
  descriptionEn: b.description_en ?? "",
  targetType: b.target_type ?? (b.batch_id ? "batch" : b.link_url ? "link" : ""),
  targetId: b.target_id ?? b.batch_id ?? "",
  linkUrl: b.link_url ?? "",
  cta: b.cta ?? "details",
  supportHoursBn: b.support_hours_bn ?? "",
  supportHoursEn: b.support_hours_en ?? "",
  phone: b.phone ?? "",
  buttons: b.buttons ?? [],
  startsAt: toLocalInput(b.starts_at),
  endsAt: toLocalInput(b.ends_at),
  orderIndex: String(b.order_index),
  status: b.status,
});

type PickRow = { id: string; title_bn: string; title_en: string; batch_title_en?: string | null; chapter?: string };

// The list to choose from loads only when its type is picked.
function TargetSelect({ type, value, onChange }: { type: "test" | "lecture" | "material"; value: string; onChange: (id: string) => void }) {
  const path = type === "test" ? "tests" : type === "lecture" ? "lectures" : "materials";
  const rows = useLoad(() => api<PickRow[]>(`/api/admin/${path}`));
  if (rows.loading && !rows.data) return <Loading />;
  if (rows.error) return <p class="error-text small">{rows.error}</p>;
  return (
    <Select
      id="b-target"
      value={value}
      placeholder={t("admin_target_pick")}
      searchable
      onChange={onChange}
      options={(rows.data ?? []).map((r) => ({
        value: r.id,
        label: [pick(r, "title"), r.batch_title_en].filter(Boolean).join(" · "),
      }))}
    />
  );
}

export function AdminBanners() {
  const [kind, setKind] = useState<"launch" | "community">("launch");
  const list = useLoad(() => api<AdminBanner[]>(`/api/admin/banners?kind=${kind}`), [kind]);
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
    const launch = kind === "launch";
    const text = (v: string) => v.trim() || null;
    const parsed = BannerUpsert.safeParse({
      kind,
      imageUrl: draft.imageUrl.trim() ? imageSrc(draft.imageUrl) : "",
      titleBn: draft.titleBn,
      titleEn: draft.titleEn,
      descriptionBn: text(draft.descriptionBn),
      descriptionEn: text(draft.descriptionEn),
      targetType: launch ? draft.targetType || null : null,
      targetId: launch && draft.targetType && draft.targetType !== "link" ? draft.targetId || null : null,
      batchId: launch && draft.targetType === "batch" ? draft.targetId || null : null,
      linkUrl: launch && draft.targetType === "link" ? draft.linkUrl.trim() || undefined : undefined,
      cta: draft.cta,
      supportHoursBn: launch ? null : text(draft.supportHoursBn),
      supportHoursEn: launch ? null : text(draft.supportHoursEn),
      phone: launch ? null : text(draft.phone),
      buttons: launch ? [] : draft.buttons.filter((b) => b.url.trim() || b.labelEn.trim() || b.labelBn.trim()),
      startsAt: toUnixSec(draft.startsAt),
      endsAt: toUnixSec(draft.endsAt),
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
  const patchButton = (i: number, changes: Partial<ButtonDraft>) =>
    setDraft((current) => (current ? { ...current, buttons: current.buttons.map((b, j) => (j === i ? { ...b, ...changes } : b)) } : current));
  const problem = (key: string) => errors[key]?.[0];
  const launch = kind === "launch";

  const schedule = (b: AdminBanner) => {
    const now = Date.now() / 1000;
    if (b.status !== "active") return null;
    if (b.starts_at && b.starts_at > now) return t("admin_banner_scheduled");
    if (b.ends_at && b.ends_at <= now) return t("admin_banner_ended");
    return null;
  };

  return (
    <div class="stack">
      <div class="row-between">
        <h1 class="title">{t("admin_tab_banners")}</h1>
        <button class="btn primary" onClick={() => setDraft(EMPTY)}>
          {t("admin_new_banner")}
        </button>
      </div>

      <Segmented
        label={t("admin_tab_banners")}
        value={kind}
        onChange={(next) => {
          close();
          setKind(next);
        }}
        options={[
          { id: "launch", label: t("admin_banner_kind_launch") },
          { id: "community", label: t("admin_banner_kind_community") },
        ]}
      />
      <p class="hint">{t(launch ? "admin_banner_kind_launch_hint" : "admin_banner_kind_community_hint")}</p>

      {list.error && <p class="error-text">{list.error}</p>}
      {list.loading && !list.data && <Loading />}
      {list.data && list.data.length === 0 && <p class="muted small">{t("admin_no_banners")}</p>}

      <div class="list">
        {(list.data ?? []).map((banner) => (
          <button class="item" key={banner.id} onClick={() => setDraft(toDraft(banner))}>
            <span class="name">{pick(banner, "title")}</span>
            <span class="meta">
              {t("admin_order", { n: banner.order_index })}
              {banner.target_type ? ` · ${t(`admin_target_${banner.target_type}`)}` : ""}
              {schedule(banner) ? ` · ${schedule(banner)}` : ""}
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
            <Field id="b-image" label={launch ? t("admin_banner_image_url") : t("admin_banner_image_optional")} error={problem("imageUrl")}>
              <input id="b-image" class="input" type="url" value={draft.imageUrl} onInput={(e) => patch({ imageUrl: e.currentTarget.value })} />
            </Field>
            <AdminImagePreview url={draft.imageUrl} />
            <Field id="b-title-en" label={t("admin_title_en")} error={problem("titleEn")}>
              <input id="b-title-en" class="input" value={draft.titleEn} onInput={(e) => patch({ titleEn: e.currentTarget.value })} />
            </Field>
            <Field id="b-title-bn" label={t("admin_title_bn")} error={problem("titleBn")}>
              <input id="b-title-bn" class="input" value={draft.titleBn} onInput={(e) => patch({ titleBn: e.currentTarget.value })} />
            </Field>
            <Field id="b-desc-en" label={t("admin_description_en")} hint={launch ? t("admin_banner_desc_hint") : t("admin_banner_rules_hint")} error={problem("descriptionEn")}>
              <textarea id="b-desc-en" class="input" rows={3} maxLength={800} value={draft.descriptionEn} onInput={(e) => patch({ descriptionEn: (e.currentTarget as HTMLTextAreaElement).value })} />
            </Field>
            <Field id="b-desc-bn" label={t("admin_description_bn")} error={problem("descriptionBn")}>
              <textarea id="b-desc-bn" class="input" rows={3} maxLength={800} value={draft.descriptionBn} onInput={(e) => patch({ descriptionBn: (e.currentTarget as HTMLTextAreaElement).value })} />
            </Field>

            {launch && (
              <>
                <Field id="b-target-type" label={t("admin_banner_opens")}>
                  <Select
                    id="b-target-type"
                    value={draft.targetType}
                    onChange={(targetType) => patch({ targetType: targetType as BannerTarget | "", targetId: "" })}
                    options={[
                      { value: "", label: t("admin_target_none") },
                      ...BANNER_TARGETS.map((type) => ({ value: type, label: t(`admin_target_${type}`) })),
                    ]}
                  />
                </Field>
                {draft.targetType === "link" && (
                  <Field id="b-link" label={t("admin_banner_link")} error={problem("linkUrl")}>
                    <input id="b-link" class="input" type="url" placeholder="https://" value={draft.linkUrl} onInput={(e) => patch({ linkUrl: e.currentTarget.value })} />
                  </Field>
                )}
                {draft.targetType === "batch" && (
                  <Field id="b-target" label={t("admin_target_batch")} error={problem("targetId")}>
                    <Select
                      id="b-target"
                      value={draft.targetId}
                      placeholder={t("admin_target_pick")}
                      searchable
                      onChange={(targetId) => patch({ targetId })}
                      options={(batches.data ?? []).map((b) => ({ value: b.id, label: pick(b, "title") }))}
                    />
                  </Field>
                )}
                {(draft.targetType === "test" || draft.targetType === "lecture" || draft.targetType === "material") && (
                  <Field id="b-target" label={t(`admin_target_${draft.targetType}`)} error={problem("targetId")}>
                    <TargetSelect key={draft.targetType} type={draft.targetType} value={draft.targetId} onChange={(targetId) => patch({ targetId })} />
                  </Field>
                )}
                {draft.targetType === "batch" && (
                  <Field id="b-cta" label={t("admin_banner_cta")} hint={t("admin_banner_cta_hint")}>
                    <Select
                      id="b-cta"
                      value={draft.cta}
                      onChange={(cta) => patch({ cta: cta as "details" | "enroll" })}
                      options={[
                        { value: "details", label: t("admin_banner_cta_details") },
                        { value: "enroll", label: t("admin_banner_cta_enroll") },
                      ]}
                    />
                  </Field>
                )}
              </>
            )}

            {!launch && (
              <>
                <Field id="b-hours-en" label={t("admin_support_hours_en")} error={problem("supportHoursEn")}>
                  <input id="b-hours-en" class="input" maxLength={200} placeholder="Mon–Sat, 10 am – 6 pm" value={draft.supportHoursEn} onInput={(e) => patch({ supportHoursEn: e.currentTarget.value })} />
                </Field>
                <Field id="b-hours-bn" label={t("admin_support_hours_bn")} error={problem("supportHoursBn")}>
                  <input id="b-hours-bn" class="input" maxLength={200} value={draft.supportHoursBn} onInput={(e) => patch({ supportHoursBn: e.currentTarget.value })} />
                </Field>
                <Field id="b-phone" label={t("admin_support_phone")} error={problem("phone")}>
                  <input id="b-phone" class="input" inputMode="tel" placeholder="+91 98765 43210" value={draft.phone} onInput={(e) => patch({ phone: e.currentTarget.value })} />
                </Field>
                <strong class="small">{t("admin_support_buttons")}</strong>
                <p class="hint">{t("admin_support_buttons_hint")}</p>
                {draft.buttons.map((button, i) => (
                  <div class="panel stack" key={i}>
                    <input class="input" aria-label={t("admin_button_label_en")} placeholder={t("admin_button_label_en")} maxLength={40} value={button.labelEn} onInput={(e) => patchButton(i, { labelEn: e.currentTarget.value })} />
                    <input class="input" aria-label={t("admin_button_label_bn")} placeholder={t("admin_button_label_bn")} maxLength={40} value={button.labelBn} onInput={(e) => patchButton(i, { labelBn: e.currentTarget.value })} />
                    <input class="input" aria-label={t("admin_button_url")} placeholder="https://wa.me/91…  or  tel:+91…" value={button.url} onInput={(e) => patchButton(i, { url: e.currentTarget.value })} />
                    {problem(`buttons`) && <span class="error-text small">{problem("buttons")}</span>}
                    <button class="btn small quiet" type="button" onClick={() => patch({ buttons: draft.buttons.filter((_, j) => j !== i) })}>
                      {t("admin_delete")}
                    </button>
                  </div>
                ))}
                {draft.buttons.length < 3 && (
                  <button class="btn small" type="button" onClick={() => patch({ buttons: [...draft.buttons, { labelBn: "", labelEn: "", url: "" }] })}>
                    {t("admin_add_button")}
                  </button>
                )}
              </>
            )}

            <Field id="b-starts" label={t("admin_banner_starts")} hint={t("admin_banner_schedule_hint")} error={problem("startsAt")}>
              <input id="b-starts" class="input" type="datetime-local" value={draft.startsAt} onInput={(e) => patch({ startsAt: e.currentTarget.value })} />
            </Field>
            <Field id="b-ends" label={t("admin_banner_ends")} error={problem("endsAt")}>
              <input id="b-ends" class="input" type="datetime-local" value={draft.endsAt} onInput={(e) => patch({ endsAt: e.currentTarget.value })} />
            </Field>
            <Field id="b-order" label={t("admin_order_index")} error={problem("orderIndex")}>
              <input id="b-order" class="input" inputMode="numeric" value={draft.orderIndex} onInput={(e) => patch({ orderIndex: e.currentTarget.value.replace(/[^0-9]/g, "") })} />
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
              <button class="btn danger block" disabled={busy} onClick={() => setDeleting(list.data?.find((b) => b.id === draft.id) ?? null)}>
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
