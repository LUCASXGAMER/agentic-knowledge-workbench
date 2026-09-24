import { useCallback, useEffect, useRef, useState } from "react";

export function useApiData<T>(loader: () => Promise<T>, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loaderRef.current();
      setData(result);
      setError("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "服务连接异常，已保留页面展示内容。";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loaderRef.current()
      .then((result) => {
        if (alive) {
          setData(result);
          setError("");
        }
      })
      .catch((err: unknown) => {
        if (alive) {
          const message = err instanceof Error ? err.message : "服务连接异常，已保留页面展示内容。";
          setError(message);
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return { data, loading, error, setData, reload };
}
