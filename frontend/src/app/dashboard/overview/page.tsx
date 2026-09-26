'use client';
import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { getDashboardKpis } from '@/features/dashboard/api';
import { useRealtimeStockUpdates } from '@/lib/realtime';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Boxes, RefreshCw, Truck } from 'lucide-react';

const cards = [['Products in stock', 'totalProducts', Boxes], ['Low-stock items', 'lowStockItems', AlertTriangle], ['Pending receipts', 'pendingReceipts', ArrowDownToLine], ['Pending deliveries', 'pendingDeliveries', ArrowUpFromLine]] as const;

export default function OverviewPage() {
  const live = useRealtimeStockUpdates();
  const query = useQuery({ queryKey: ['dashboard', 'kpis'], queryFn: getDashboardKpis, refetchInterval: 60_000 });
  const data = query.data;
  return <PageContainer><main className="min-h-full bg-[#f7f8fc] px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1480px] space-y-6">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-semibold uppercase tracking-wider text-indigo-500">Workspace / Overview</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Inventory control center</h1><p className="mt-1 text-sm text-slate-500">Live operational health from your stock ledger.</p></div><div className={'inline-flex items-center gap-2 self-start rounded-full px-3 py-2 text-xs font-semibold md:self-auto ' + (live ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}><span className="size-2 rounded-full bg-current" />{live ? 'Live updates connected' : 'Reconnecting to live updates'}</div></header>
    {query.isError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Unable to load dashboard data. Check the API connection and retry.</div> : null}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, key, Icon]) => <div key={key} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex size-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Icon className="size-5" /></div><p className="mt-4 text-sm font-medium text-slate-500">{label}</p><p className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{query.isLoading ? '—' : data?.[key]}</p></div>)}</div>
    <section className="grid gap-5 lg:grid-cols-3"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2"><div className="flex items-start justify-between"><div><h2 className="font-semibold text-slate-900 dark:text-white">Operational pulse</h2><p className="mt-1 text-xs text-slate-500">Live counters from the inventory workflow.</p></div><Activity className="size-5 text-indigo-500" /></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><Metric label="Internal transfers" value={data?.internalTransfersCount} /><Metric label="Ledger activity, last 24h" value={data?.recentLedgerActivity} /></div></div><div className="rounded-2xl bg-slate-950 p-5 text-white shadow-lg"><Truck className="size-6 text-indigo-300" /><h2 className="mt-5 text-lg font-semibold">Keep operations moving</h2><p className="mt-2 text-sm leading-relaxed text-slate-400">Open the operational queues to receive, dispatch, transfer, or adjust inventory.</p><div className="mt-6 grid gap-2"><Link className="rounded-lg bg-white/10 px-3 py-2 text-center text-sm font-semibold hover:bg-white/15" href="/dashboard/receipts">Review receipts</Link><Link className="rounded-lg bg-indigo-500 px-3 py-2 text-center text-sm font-semibold hover:bg-indigo-400" href="/dashboard/products">Review stock</Link></div></div></section>
    <button className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600" onClick={() => void query.refetch()}><RefreshCw className="size-4" /> Refresh dashboard</button>
  </div></main></PageContainer>;
}
function Metric({ label, value }: { label: string; value?: number }) { return <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value ?? '—'}</p></div>; }
