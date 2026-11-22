// Small, tested rules a banner and its batch card share.

/** Is a banner inside its schedule right now? Empty start/end mean "from now" / "until switched off". */
export function isScheduledNow(b: { starts_at?: number | null; ends_at?: number | null }, nowSec: number): boolean {
  if (b.starts_at && b.starts_at > nowSec) return false;
  if (b.ends_at && b.ends_at <= nowSec) return false;
  return true;
}

/** Percent off, or null when there is no real discount to show. */
export function discountPercent(pricePaise: number, mrpPaise: number | null | undefined): number | null {
  if (!mrpPaise || mrpPaise <= pricePaise || pricePaise < 0) return null;
  return Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);
}

/** What to show for the fee: free, the price, or the price with the old one struck through. */
export function feeLabel(pricePaise: number, mrpPaise: number | null | undefined, kind: string) {
  if (kind === "free" || pricePaise === 0) return { free: true as const, price: 0, mrp: null, off: null };
  const off = discountPercent(pricePaise, mrpPaise);
  return { free: false as const, price: pricePaise, mrp: off ? (mrpPaise as number) : null, off };
}
