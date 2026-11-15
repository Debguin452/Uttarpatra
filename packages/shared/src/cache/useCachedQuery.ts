import { useEffect, useRef, useState } from "preact/hooks";
import { idbGet, idbSet, isFresh } from "./idbStore";

type QueryState<T> = {
  data: T | null;
  isStale: boolean;   // true = we're showing a cached copy while refetching
  isLoading: boolean; // true only on a genuine first load with nothing cached
  error: string | null;
  syncedAt: number | null;
};

// Dedupe concurrent callers (e.g. Home and a widget both asking for the
// same batch list on mount) into one network request.
const inflight = new Map<string, Promise<unknown>>();

/**
 * Cache-then-network with a TTL. On mount: paint the cached value
 * immediately if one exists (however stale), then revalidate in the
 * background and repaint only if the response actually differs. This
 * is what makes repeat visits to Home/Batches feel instant even on a
 * slow mobile connection, and keeps the catalog browsable offline.
 */
export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { ttlMs?: number } = {},
): QueryState<T> & { refetch: () => void } {
  const ttlMs = opts.ttlMs ?? 5 * 60_000; // 5 min default: catalog data, not live scores
  const [state, setState] = useState<QueryState<T>>({
    data: null,
    isStale: false,
    isLoading: true,
    error: null,
    syncedAt: null,
  });
  const mounted = useRef(true);
  useEffect(() => () => void (mounted.current = false), []);

  async function revalidate(cachedValue: T | null, cachedStoredAt: number | null) {
    try {
      let promise = inflight.get(key) as Promise<T> | undefined;
      if (!promise) {
        promise = fetcher();
        inflight.set(key, promise);
        promise.finally(() => inflight.delete(key));
      }
      const fresh = await promise;
      await idbSet(key, fresh, ttlMs);
      if (!mounted.current) return;
      setState({ data: fresh, isStale: false, isLoading: false, error: null, syncedAt: Date.now() });
    } catch (e) {
      if (!mounted.current) return;
      // Network failed: if we already painted a cached value, stay on
      // it silently rather than replacing a working screen with an
      // error — this is the offline/flaky-network path.
      setState((s) => ({
        ...s,
        isLoading: false,
        error: cachedValue ? null : "offline_or_down",
        syncedAt: cachedStoredAt,
      }));
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadThenMaybeRevalidate() {
      const cached = await idbGet<T>(key);
      if (cancelled) return;
      if (cached) {
        setState({
          data: cached.value,
          isStale: !isFresh(cached),
          isLoading: false,
          error: null,
          syncedAt: cached.storedAt,
        });
        if (!isFresh(cached)) revalidate(cached.value, cached.storedAt);
      } else {
        setState((s) => ({ ...s, isLoading: true }));
        revalidate(null, null);
      }
    }
    void loadThenMaybeRevalidate();

    // Mount-time freshness is not enough: an installed app that's
    // backgrounded and resumed (the normal lifecycle on mobile) never
    // remounts this component, so without this listener data past its
    // TTL would otherwise sit stale for the rest of the session. This
    // is the data-side counterpart of the service-worker update check
    // in main.tsx — both exist so a long-lived session converges back
    // to current instead of silently drifting from it.
    function onVisible() {
      if (document.visibilityState === "visible") void loadThenMaybeRevalidate();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { ...state, refetch: () => revalidate(state.data, state.syncedAt) };
}
