"use client";

import { useCallback, useEffect, useState } from "react";
import { ParentItem } from "./ParentsListColumn";

/** Loads parents with their Sarvam calls, daily logs and AI reviews. */
export function useParents() {
  const [parents, setParents] = useState<ParentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/parents", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't load parents");
      setParents(data.parents || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Couldn't load parents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { parents, loading, error, reload };
}
