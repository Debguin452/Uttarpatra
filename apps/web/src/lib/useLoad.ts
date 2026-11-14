import { useCallback, useEffect, useState } from "preact/hooks";
import { api, ApiError } from "./api";
import { errorText } from "./format";

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loader());
      setError(null);
    } catch (e) {
      setError(errorText(e instanceof ApiError ? e.code : "network"));
    }
    setLoading(false);
  }, deps);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload };
}

export const getJson = <T>(path: string) => api<T>(path);
