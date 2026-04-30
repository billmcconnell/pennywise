import { useQuery } from '@tanstack/react-query';

type Health = { ok: boolean; ts: string };

async function fetchHealth(): Promise<Health> {
  const res = await fetch('/api/healthz');
  if (!res.ok) throw new Error(`health ${res.status}`);
  return res.json() as Promise<Health>;
}

export function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 5_000,
  });

  return (
    <main className="mx-auto flex h-full max-w-2xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-3xl font-semibold">Budget</h1>
        <p className="text-sm text-zinc-500">Phase 0 scaffold — hello household.</p>
      </header>

      <section className="rounded-lg border border-zinc-200 p-4">
        <h2 className="mb-2 text-lg font-medium">API health</h2>
        {isLoading && <p className="text-zinc-500">checking…</p>}
        {error && <p className="text-red-600">error: {(error as Error).message}</p>}
        {data && (
          <pre className="rounded bg-zinc-50 p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>
        )}
      </section>
    </main>
  );
}
