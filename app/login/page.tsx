"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";

function LoginPageInner() {
  const supabase = createClient();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/home";

  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function handleMagicLink() {
    if (!email.trim()) return;
    setMagicLoading(true);
    setMagicError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setMagicError(error.message);
      setMagicLoading(false);
    } else {
      setMagicSent(true);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 p-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-latin text-4xl font-bold tracking-tight">yomu</h1>
        <p className="text-sm text-muted">おかえりなさい</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-4">
        <Button size="lg" className="w-full gap-2" onClick={handleGoogleLogin}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path
              fill="currentColor"
              d="M12 11v2.4h6.8c-.3 1.8-2 4.6-6.8 4.6-4.1 0-7.5-3.4-7.5-7.5s3.4-7.5 7.5-7.5c2.3 0 3.9.99 4.8 1.84l3.26-3.14C17.96 0 15.23-.01 12 0 5.37 0 0 5.37 0 12s5.37 12 12 12c6.92 0 11.5-4.87 11.5-12 0-.81-.09-1.42-.19-2H12z"
            />
          </svg>
          Googleでログイン
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted">または</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {magicSent ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/20 p-4 text-center">
            <CheckCircle2 className="size-8 text-green-500" />
            <p className="text-sm font-medium">メールを送りました</p>
            <p className="text-xs text-muted">
              {email} に届いたリンクをクリックしてログインできます
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="メールアドレス"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleMagicLink()}
                className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleMagicLink}
                disabled={magicLoading || !email.trim()}
                className="shrink-0"
              >
                <Mail className="size-4" />
              </Button>
            </div>
            {magicError && <p className="text-xs text-red-500">{magicError}</p>}
            <p className="text-center text-xs text-muted">
              メールでログインリンクを受け取る
            </p>
          </div>
        )}
      </div>

      <p className="text-xs text-muted">
        アカウントをお持ちでない方は{" "}
        <Link
          href="/register"
          className="text-foreground underline underline-offset-4"
        >
          新規登録
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
          読み込み中...
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
