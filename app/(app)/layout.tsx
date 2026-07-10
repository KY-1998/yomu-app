// ログイン後の共通レイアウト: ヘッダー + ボトムナビ
import Link from "next/link";
import { Home, Camera, UserRound } from "lucide-react";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      {/* ヘッダー */}
      <header className="sticky top-0 z-20 flex items-center justify-between bg-background/70 px-6 py-4 backdrop-blur-xl">
        <Link href="/home" className="font-latin text-xl tracking-tight text-foreground">
          yomu
        </Link>
        <p className="font-latin text-xs tracking-[0.15em] text-muted">
          {new Intl.DateTimeFormat("ja-JP", {
            month: "long",
            day: "numeric",
            weekday: "short",
            timeZone: "Asia/Tokyo",
          }).format(new Date())}
        </p>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      {/* ボトムナビ */}
      <nav className="glass fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md bg-background/70 backdrop-blur-xl">
        <div className="flex items-center justify-around py-2">
          <Link href="/home" className="flex flex-col items-center gap-0.5 p-2 text-muted transition-colors hover:text-foreground">
            <Home className="size-5" strokeWidth={1.6} />
            <span className="text-[10px]">きょう</span>
          </Link>
          <Link
            href="/post"
            className="-mt-6 flex size-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/25 transition-transform active:scale-95"
            aria-label="投稿する"
          >
            <Camera className="size-6" strokeWidth={1.8} />
          </Link>
          <Link href="/home" className="flex flex-col items-center gap-0.5 p-2 text-muted transition-colors hover:text-foreground">
            <UserRound className="size-5" strokeWidth={1.6} />
            <span className="text-[10px]">じぶん</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
