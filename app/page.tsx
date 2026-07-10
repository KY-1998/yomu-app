"use client";
// ランディングページ（ログイン前）
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

export default function LandingPage() {
  const supabase = createClient();

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-7 pb-12 pt-16">
      {/* ロゴ */}
      <p className="font-latin text-xl tracking-tight text-accent">yomu</p>

      {/* キャッチコピー */}
      <section className="mt-16">
        <h1 className="font-heading text-[1.9rem] leading-[1.7] tracking-wide">
          友達の今日を見る。
          <br />
          あなたの今日を届ける。
        </h1>
        <p className="mt-6 text-sm leading-7 text-muted">
          顔・景色・天気・ご飯。
          <br />
          4枚の写真で綴る、1日1回だけのSNS。
          <br />
          あなたが投稿すると、友達の今日が見えます。
        </p>
      </section>

      {/* 4カテゴリのプレビュー（2×2） */}
      <section className="mt-12 grid grid-cols-2 gap-3">
        {CATEGORIES.map((c) => (
          <div
            key={c.key}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-muted-soft bg-card"
          >
            <span className="text-3xl opacity-70">{c.emoji}</span>
            <span className="font-heading text-sm">{c.label}</span>
            <span className="font-latin text-[10px] uppercase tracking-[0.2em] text-muted">
              {c.key}
            </span>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="mt-auto flex flex-col gap-3 pt-14">
        <Button size="lg" className="w-full" onClick={handleGoogleLogin}>
          <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
            <path d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 4.3-5.35 4.3a5.8 5.8 0 1 1 0-11.6c1.5 0 2.8.55 3.8 1.45l2.15-2.15A8.7 8.7 0 1 0 12 20.7c5 0 8.7-3.5 8.7-8.7 0-.3-.02-.6-.05-.9z" />
          </svg>
          Googleではじめる
        </Button>
        <Link href="/home" className="w-full">
          <Button variant="ghost" size="sm" className="w-full">
            プレビューを見る（開発用）
          </Button>
        </Link>
        <p className="text-center text-[11px] leading-5 text-muted">
          登録すると利用規約・プライバシーポリシーに同意したことになります
        </p>
      </section>
    </main>
  );
}
