"use client";
import { Button } from "@zeaops/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-content-center gap-4 p-8">
      <h1 className="text-2xl">The control plane could not load</h1>
      <p className="text-slate-400">Try loading the dashboard again.</p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
