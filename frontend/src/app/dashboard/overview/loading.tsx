import PageContainer from '@/components/layout/page-container';

function Pulse({ className }: { className: string }) {
  return <div className={'animate-pulse rounded-lg bg-slate-800/70 ' + className} />;
}

export default function OverviewLoading() {
  return (
    <PageContainer>
      <div className="min-h-full bg-[#f7f8fc] px-4 py-6 dark:bg-slate-950 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1480px] space-y-6">
          <div className="space-y-3"><Pulse className="h-3 w-24" /><Pulse className="h-9 w-80" /><Pulse className="h-4 w-96" /></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 rounded-2xl border border-slate-800 bg-slate-900 p-5"><Pulse className="h-10 w-10 rounded-xl" /><Pulse className="mt-5 h-4 w-28" /><Pulse className="mt-2 h-7 w-32" /></div>)}</div>
          <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]"><Pulse className="h-[390px] rounded-2xl" /><Pulse className="h-[390px] rounded-2xl" /></div>
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><Pulse className="h-52 rounded-2xl" /><Pulse className="h-52 rounded-2xl" /></div>
        </div>
      </div>
    </PageContainer>
  );
}

