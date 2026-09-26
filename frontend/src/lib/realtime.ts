'use client';

import { useEffect, useRef, useState } from 'react';
import { getQueryClient } from './query-client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export function useRealtimeStockUpdates() {
  const [connected, setConnected] = useState(false);
  const source = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `${BASE_URL}/realtime/events`;
    const eventSource = new EventSource(url, { withCredentials: true });
    source.current = eventSource;
    eventSource.onopen = () => setConnected(true);
    eventSource.onerror = () => setConnected(false);
    eventSource.addEventListener('stock.changed', () => {
      const queryClient = getQueryClient();
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    });
    return () => {
      eventSource.close();
      source.current = null;
      setConnected(false);
    };
  }, []);

  return connected;
}
