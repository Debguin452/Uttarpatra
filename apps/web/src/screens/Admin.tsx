import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { Loading, Sheet } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { errorText, money, pick, when } from "../lib/format";
import { useBatches } from "../lib/queries";
import type { AdminPayment, AdminUser } from "../lib/types";

export function AdminPayments() {
  const [rows, setRows] = useState<AdminPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [shot, setShot] = useState<{ id: string; src: string } | null>(null);
  const [rejecting, setRejecting] = useState<AdminPayment | null>(null);
  const [note, setNote] = useState("");
  const batches = useBatches();
  const titles = new Map((batches.data ?? []).map((b) => [b.id, pick(b, "title")]));

  async function load() {
    setError(null);
    try {
      setRows(await api<AdminPayment[]>("/api/admin/payments/pending"));
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function viewScreenshot(id: string) {
    try {
      const res = await api<{ screenshotBase64: string | null }>(`/api/admin/payments/${id}/screenshot`);
      if (res.screenshotBase64) setShot({ id, src: `data:image/jpeg;base64,${res.screenshotBase64}` });
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    }
  }

  async function decide(payment: AdminPayment, decision: "approved" | "rejected", noteText?: string) {
    setBusyId(payment.id);
    try {
      await api("/api/admin/payments/review", { body: { paymentId: payment.id, decision, note: noteText || undefined } });
      setRows((r) => (r ?? []).filter((p) => p.id !== payment.id));
      setRejecting(null);
      setNote("");
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    } finally {
      setBusyId(null);
    }
  }

  if (!rows) return error ? <p class="error-text">{error}</p> : <Loading />;

  return (
    <>
      {error && <p class="error-text">{error}</p>}
      {rows.length === 0 ? (
        <p class="muted small">{t("admin_no_pending")}</p>
      ) : (
        <div class="list">
          {rows.map((p) => (
            <div class="item" key={p.id}>
              <span class="name">{p.name}</span>
              <span class="meta">
                {titles.get(p.batch_id) ?? p.batch_id} · {money(p.amount_paise)} · {p.utr ?? "—"} · {when(p.created_at)}
              </span>
              <span class="side" style="flex-direction:column;align-items:stretch;gap:6px">
                <button class="btn small quiet" onClick={() => viewScreenshot(p.id)}>
                  {t("admin_view_shot")}
                </button>
                <div style="display:flex;gap:8px">
                  <button class="btn small" onClick={() => decide(p, "approved")} disabled={busyId === p.id}>
                    {t("admin_approve")}
                  </button>
                  <button class="btn small danger" onClick={() => setRejecting(p)} disabled={busyId === p.id}>
                    {t("admin_reject")}
                  </button>
                </div>
              </span>
            </div>
          ))}
        </div>
      )}

      {shot && (
        <Sheet onClose={() => setShot(null)}>
          <img src={shot.src} alt="" style="width:100%;border:1px solid var(--line)" />
          <button class="btn block" onClick={() => setShot(null)}>
            {t("close")}
          </button>
        </Sheet>
      )}

      {rejecting && (
        <Sheet onClose={busyId ? undefined : () => setRejecting(null)}>
          <h2 class="subtitle">{t("admin_reject_title")}</h2>
          <div class="field">
            <label for="note">{t("admin_reject_note")}</label>
            <textarea
              id="note"
              class="input"
              rows={3}
              value={note}
              onInput={(e) => setNote((e.currentTarget as HTMLTextAreaElement).value)}
            />
          </div>
          <button
            class="btn danger block"
            onClick={() => decide(rejecting, "rejected", note.trim())}
            disabled={busyId === rejecting.id}
          >
            {t("admin_confirm_reject")}
          </button>
          <button class="btn quiet block" onClick={() => setRejecting(null)} disabled={busyId === rejecting.id}>
            {t("cancel")}
          </button>
        </Sheet>
      )}
    </>
  );
}

type Confirm = { kind: "reset" | "block" | "unblock"; user: AdminUser };

export function AdminUsers({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  async function search(event?: Event) {
    event?.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    setError(null);
    setRows(null);
    try {
      setRows(await api<AdminUser[]>(`/api/admin/users/search?q=${encodeURIComponent(q)}`));
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
      setRows([]);
    }
  }

  async function act() {
    if (!confirm) return;
    setBusyUid(confirm.user.uid);
    try {
      if (confirm.kind === "reset") {
        await api(`/api/admin/users/${confirm.user.uid}/reset-device`, { method: "POST" });
        setRows((r) => (r ?? []).map((u) => (u.uid === confirm.user.uid ? { ...u, device_bound: 0, bound_at: null } : u)));
      } else {
        const status = confirm.kind === "block" ? "blocked" : "active";
        await api(`/api/admin/users/${confirm.user.uid}/status`, { body: { status } });
        setRows((r) => (r ?? []).map((u) => (u.uid === confirm.user.uid ? { ...u, status } : u)));
      }
      setConfirm(null);
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    } finally {
      setBusyUid(null);
    }
  }

  return (
    <>
      <form class="stack" onSubmit={search}>
        <div class="field">
          <label for="uq">{t("admin_search_label")}</label>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
            <input
              id="uq"
              class="input"
              autocomplete="off"
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
              placeholder={t("admin_search_placeholder")}
            />
            <button class="btn" type="submit" disabled={query.trim().length < 2}>
              {t("admin_search_go")}
            </button>
          </div>
        </div>
      </form>

      {error && <p class="error-text">{error}</p>}

      {rows &&
        (rows.length === 0 ? (
          <p class="muted small">{t("admin_no_results")}</p>
        ) : (
          <div class="list">
            {rows.map((u) => (
              <div class="item" key={u.uid}>
                <span class="name">{u.name}</span>
                <span class="meta">
                  {u.phone ?? "—"} ·{" "}
                  <span class={u.status === "blocked" ? "badge error" : "badge mark"}>
                    {t(u.status === "blocked" ? "admin_blocked" : "admin_active")}
                  </span>{" "}
                  · {u.device_bound ? t("admin_device_bound") : t("admin_device_none")}
                </span>
                <span class="side" style="flex-direction:column;align-items:stretch;gap:6px">
                  {Boolean(u.device_bound) && (
                    <button class="btn small quiet" onClick={() => setConfirm({ kind: "reset", user: u })} disabled={busyUid === u.uid}>
                      {t("admin_reset_device")}
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button
                      class={u.status === "blocked" ? "btn small" : "btn small danger"}
                      onClick={() => setConfirm({ kind: u.status === "blocked" ? "unblock" : "block", user: u })}
                      disabled={busyUid === u.uid}
                    >
                      {t(u.status === "blocked" ? "admin_unblock" : "admin_block")}
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        ))}

      {confirm && (
        <Sheet onClose={busyUid ? undefined : () => setConfirm(null)}>
          <h2 class="subtitle">{t(`admin_confirm_${confirm.kind}_title`)}</h2>
          <p class="muted small">{t(`admin_confirm_${confirm.kind}_body`, { name: confirm.user.name })}</p>
          <button
            class={confirm.kind === "block" ? "btn danger block" : "btn primary block"}
            onClick={act}
            disabled={busyUid === confirm.user.uid}
          >
            {t("admin_confirm_go")}
          </button>
          <button class="btn quiet block" onClick={() => setConfirm(null)} disabled={busyUid === confirm.user.uid}>
            {t("cancel")}
          </button>
        </Sheet>
      )}
    </>
  );
}
