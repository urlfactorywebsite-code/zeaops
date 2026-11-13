import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-content-center gap-4 p-8">
      <h1 className="text-2xl">Route not found</h1>
      <Link href="/" className="text-cyan-300 underline">
        Return to overview
      </Link>
    </main>
  );
}
