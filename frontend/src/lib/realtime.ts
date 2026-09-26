'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getQueryClient } from './query-client';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export function useRealtimeStockUpdates() {
  const [connected, setConnected] = useState(false);
  const source = useRef<Socket | null>(null);

  useEffect(() => {
    const socketBaseUrl = BASE_URL.replace(/\/api\/v1$/, '');
    const socket = io(`${socketBaseUrl}/dashboard`, { withCredentials: true, transports: ['websocket', 'polling'] });
    source.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    const invalidateInventory = () => {
      const queryClient = getQueryClient();
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['documents'] });
    };
    socket.on('stock.changed', invalidateInventory);
    socket.on('document.status_changed', invalidateInventory);
    socket.on('alert.low_stock', () => {
      invalidateInventory();
      void getQueryClient().invalidateQueries({ queryKey: ['dashboard', 'alerts'] });
    });
    return () => {
      socket.close();
      source.current = null;
      setConnected(false);
    };
  }, []);

  return connected;
}
