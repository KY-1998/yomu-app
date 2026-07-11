import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 p-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-latin text-4xl font-bold tracking-tight">yomu</h1>
        <p className="text-center text-sm text-muted">
          毎日4枚の写真を交換する、
          <br />
          友達とだけのSNS
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          href="/login"
          className="inline-flex h-13 w-full items-center justify-center rounded-full bg-accent px-8 text-base font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          ログイン
        </Link>
        <Link
          href="/register"
          className="inline-flex h-13 w-full items-center justify-center rounded-full border border-muted-soft bg-card px-8 text-base font-medium text-foreground transition-all hover:border-accent/40 active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          新規登録
        </Link>
      </div>
    </div>
  );
}
