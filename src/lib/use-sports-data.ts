'use client';

import { useState, useEffect, useCallback } from 'react';

// =============================================
// SPORTS DATA HOOK
// Real API only — no mock fallback
// =============================================

type SportsDataType = 'live' | 'standings' | 'fixtures' | 'scorers' | 'all';

interface UseSportsDataOptions {
  type: SportsDataType;
  refreshInterval?: number; // ms — auto refresh (for live scores)
}

export function useSportsData<T>(options: UseSportsDataOptions) {
  const { type, refreshInterval } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/sports?type=${type}`);
      const json = await res.json();

      if (json.success && json.data && (Array.isArray(json.data) ? json.data.length > 0 : Object.keys(json.data).length > 0)) {
        setData(json.data);
        setError(false);
        setLoading(false);
        return;
      }
    } catch {
      // API failed
    }

    // No mock fallback — just set null
    setData(null);
    setError(true);
    setLoading(false);
  }, [type]);

  useEffect(() => {
    fetchData();

    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  return { data, loading, error, refetch: fetchData };
}
