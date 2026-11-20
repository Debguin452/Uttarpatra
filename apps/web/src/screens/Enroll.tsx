import { useEffect, useState } from "preact/hooks";
import { t } from "@coaching-app/shared/i18n";
import { QUOTA } from "@coaching-app/shared/schema";
import { Loading } from "../components/ui";
import { Turnstile } from "../components/Turnstile";
import { api, ApiError } from "../lib/api";
import { compressImage } from "../lib/compressImage";
import { errorText, money, pick } from "../lib/format";
import { invalidateQuery } from "@coaching-app/shared/cache/useCachedQuery";
import { paymentsKey, useBatches, usePayments } from "../lib/queries";
import { enrollState } from "../lib/enrollment";
import { refreshMe, uid } from "../lib/session";
import { go } from "../lib/router";

const UPI_ID: string = import.meta.env.VITE_UPI_ID ?? "";
const UPI_PAYEE: string = import.meta.env.VITE_UPI_PAYEE ?? "";
const UTR_PATTERN = /^[A-Za-z0-9]{10,22}$/;

export function Enroll({ batchId }: { batchId: string }) {
  const batches = useBatches();
  const batch = batches.data?.find((b) => b.id === batchId);
  const payments = usePayments();
  const state = batch ? enrollState(batch, payments.data) : null;

  // Look again before asking for money: the payment may already have been approved.
  useEffect(() => void refreshMe(true), [batchId]);

  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [utr, setUtr] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenRound, setTokenRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (batch) setAmount(batch.price_paise);
  }, [batch?.id]);

  async function applyCoupon() {
    setCouponError(null);
    try {
      const quote = await api<{ amountPaise: number; couponApplied: boolean }>(
        `/api/payments/quote?batchId=${encodeURIComponent(batchId)}&coupon=${encodeURIComponent(coupon.trim())}`,
      );
      setAmount(quote.amountPaise);
      setApplied(quote.couponApplied ? coupon.trim() : null);
    } catch (e) {
      setApplied(null);
      if (batch) setAmount(batch.price_paise);
      setCouponError(errorText(e instanceof ApiError ? e.code : "network"));
    }
  }

  async function pickFile(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    setImageError(false);
    setScreenshot(null);
    if (!file) return;
    try {
      setScreenshot(await compressImage(file, QUOTA.maxScreenshotBytes));
    } catch {
      setImageError(true);
    }
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (!screenshot || !token) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/payments/manual-upi", {
        body: { batchId, utr: utr.trim(), couponCode: applied ?? undefined, screenshotBase64: screenshot },
        headers: { "cf-turnstile-token": token },
      });
      // The payment list is cached for a minute; drop it so the new
      // pending payment shows up on Profile straight away.
      await invalidateQuery(paymentsKey(uid()));
      setDone(true);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "network";
      if (code === "already_enrolled") {
        // The server knows better than this device: sync, then open the batch.
        await refreshMe(true);
        go(`batches/${batchId}`);
        return;
      }
      if (code === "payment_pending") await invalidateQuery(paymentsKey(uid()));
      const reason = e instanceof ApiError && Array.isArray(e.body.reason) ? ` (${e.body.reason.join(", ")})` : "";
      setError(errorText(code) + (code === "turnstile_failed" ? reason : ""));
      setBusy(false);
      // The token was spent by this attempt, pass or fail: get a fresh one.
      setToken(null);
      setTokenRound((n) => n + 1);
    }
  }

  if (!batches.data) return <div class="screen"><Loading /></div>;
  if (!batch) return <div class="screen"><p class="muted">{t("no_batches")}</p></div>;

  // Nothing to pay for: say so, and take the student where they want to go.
  if (state && (state.kind === "enrolled" || state.kind === "free" || state.kind === "pending")) {
    return (
      <div class="screen">
        <div class="panel stack">
          <h1 class="subtitle">
            {state.kind === "pending" ? t("under_review_title") : state.kind === "free" ? t("batch_is_free") : t("already_enrolled_title")}
          </h1>
          <p class="muted small">
            {state.kind === "pending" ? t("under_review_hint") : state.kind === "free" ? t("batch_free_hint") : t("already_enrolled_hint")}
          </p>
          <button class="btn primary block" onClick={() => go(`batches/${batchId}`)}>
            {state.kind === "pending" ? t("back") : t("open_batch")}
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div class="screen">
        <div class="panel">
          <h1 class="subtitle">{t("payment_pending")}</h1>
          <p class="muted small">{t("payment_pending_note")}</p>
          <button class="btn block" onClick={() => go("batches")}>
            {t("back")}
          </button>
        </div>
      </div>
    );
  }

  const payable = amount ?? batch.price_paise;
  const upiLink =
    `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_PAYEE)}` +
    `&am=${(payable / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(batch.id)}`;
  const ready = UTR_PATTERN.test(utr.trim()) && screenshot !== null && token !== null && !busy;

  return (
    <div class="screen">
      <button class="btn small quiet" style="justify-self:start" onClick={() => go(`batches/${batchId}`)}>
        {t("back")}
      </button>
      <header class="stack">
        <h1 class="title">{t("enroll_title", { batch: pick(batch, "title") })}</h1>
        <p class="muted small">{t("upi_steps")}</p>
      </header>

      <div class="panel">
        <div class="row-between">
          <span class="muted">{t("amount")}</span>
          <strong class="score">{money(payable)}</strong>
        </div>
        <a class="btn primary block" href={upiLink}>
          {t("pay_with_upi")}
        </a>
      </div>

      <div class="field">
        <label for="coupon">{t("coupon")}</label>
        <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
          <input id="coupon" class="input" value={coupon} onInput={(e) => setCoupon(e.currentTarget.value)} />
          <button class="btn" type="button" onClick={applyCoupon} disabled={!coupon.trim()}>
            {t("apply")}
          </button>
        </div>
        {couponError && <span class="error-text">{couponError}</span>}
      </div>

      <form class="stack" onSubmit={submit}>
        <div class="field">
          <label for="utr">{t("utr")}</label>
          <input id="utr" class="input" autocomplete="off" value={utr} onInput={(e) => setUtr(e.currentTarget.value)} />
        </div>
        <div class="field">
          <label for="shot">{t("screenshot")}</label>
          <input id="shot" class="input" type="file" accept="image/*" onChange={pickFile} />
          {imageError && <span class="error-text">{t("image_too_large")}</span>}
        </div>
        <Turnstile onToken={setToken} resetKey={tokenRound} />
        {error && <p class="error-text">{error}</p>}
        <button class="btn primary stamp block" type="submit" disabled={!ready}>
          {t("submit_payment")}
        </button>
      </form>
    </div>
  );
}
