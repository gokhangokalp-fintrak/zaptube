'use client';

import { useState, useEffect, useCallback } from 'react';
import * as mockData from '@/lib/sports-data';

// =============================================
// SPORTS DATA HOOK
// Tries real API first → falls back to mock data
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
  const [isRealData, setIsRealData] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Try real API
      const res = await fetch(`/api/sports?type=${type}`);
      const json = await res.json();

      if (json.success && json.data && (Array.isArray(json.data) ? json.data.length > 0 : Object.keys(json.data).length > 0)) {
        setData(json.data);
        setIsRealData(true);
        setLoading(false);
        return;
      }
    } catch {
      // API failed, fall through to mock
    }

    // Fallback to mock data
    try {
      let mock: any;
      switch (type) {
        case 'live':
          // No mock for live — return empty
          mock = [];
          break;
        case 'standings':
          mock = await mockData.getStandings();
          break;
        case 'fixtures':
          mock = await mockData.getFixtures();
          break;
        case 'scorers':
          mock = await mockData.getTopScorers();
          break;
        case 'all':
          const [standings, fixtures, topScorers] = await Promise.all([
            mockData.getStandings(),
            mockData.getFixtures(),
            mockData.getTopScorers(),
          ]);
          mock = { live: [], standings, fixtures, topScorers };
          break;
      }
      setData(mock);
      setIsRealData(false);
    } catch {
      setData(null);
    }

    setLoading(false);
  }, [type]);

  useEffect(() => {
    fetchData();

    // Auto-refresh for live scores
    if (refreshInterval && refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval]);

  return { data, loading, isRealData, refetch: fetchData };
}
