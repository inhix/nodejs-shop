import { ApiStatus } from '../api-status/api-status';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 p-6">
      <h1 className="text-3xl font-semibold">Магазин</h1>
      <ApiStatus />
    </main>
  );
}
