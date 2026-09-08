import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[70dvh] place-items-center px-6 py-12 text-center">
      <div>
        <p className="font-handmade text-4xl tracking-tight text-primary-text">Shhh</p>
        <h1 className="mt-4 text-xl font-semibold text-primary-text">This page isn’t here</h1>
        <p className="mt-2 text-sm text-secondary-text">It may have moved, or the link is old.</p>
        <Link
          href="/chat"
          className="bg-button text-on-button mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold"
        >
          Go to Chat
        </Link>
      </div>
    </div>
  );
}
