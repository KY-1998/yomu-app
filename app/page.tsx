"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2 } from "lucide-react";

export default function LandingPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicError, setMagicError] = useState<string | null>(null);

  async function handleGoogleLogin() {
    const next = new URLSearchParams(window.location.search).get("next") ?? "/home";
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function handleAppleLogin() {
    const next = new URLSearchParams(window.location.search).get("next") ?? "/home";
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function handleMagicLink() {
    if (!email.trim()) return;
    setMagicLoading(true); setMagicError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(new URLSearchParams(window.location.search).get("next") ?? "/home")}` },
    });
    if (error) { setMagicError(error.message); setMagicLoading(false); }
    else setMagicSent(true);
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 p-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-latin text-4xl font-bold tracking-tight">yomu</h1>
        <p className="text-center text-sm text-muted">
          毎日4枚の写真を交換する、<br />友達とだけのSNS
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-4">
        {/* Google Login */}
        <Button size="lg" className="w-full gap-2" onClick={handleGoogleLogin}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
            <path fill="currentColor" d="M12 11v2.4h6.8c-.3 1.8-2 4.6-6.8 4.6-4.1 0-7.5-3.4-7.5-7.5s3.4-7.5 7.5-7.5c2.3 0 3.9.99 4.8 1.84l3.26-3.14C17.96 0 15.23-.01 12 0 5.37 0 0 5.37 0 12s5.37 12 12 12c6.92 0 11.5-4.87 11.5-12 0-.81-.09-1.42-.19-2H12z"/>
          </svg>
          Googleではじめる
        </Button>

        {/* Apple Login */}
        <Button size="lg" className="w-full gap-2 bg-black text-white hover:bg-black/90" onClick={handleAppleLogin}>
          <svg viewBox="0 0 814 1000" className="size-4" aria-hidden>
            <path fill="currentColor" d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76.5 0-103.7 40.8-165.9 40.8s-105-37.5-157.5-107.1c-44-63.9-80.6-156.8-80.6-244.7 0-188.8 123.1-288.8 244.2-288.8 60.5 0 110.3 39.5 147.8 39.5 35.4 0 90.2-42 158.3-42 24.3 0 108.2 1.9 163.7 73.2zm-156.4-173.5c6.4-32.4 32.1-69 65.6-94.1 28.4-21.1 70.7-36.9 104.2-36.9 1.9 0 3.9 0 5.8.6-4.5 34.8-20.7 68.4-47.8 93.5-27.5 25.6-69.5 44-111.2 42.6-.1-1.9-.1-3.8-.1-5.7z"/>
          </svg>
          Appleではじめる
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-border" />
          <span className="text-xs text-muted">または</span>
          <div className="flex-1 border-t border-border" />
        </div>

        {/* Magic Link */}
        {magicSent ? (
          <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/20 p-4 text-center">
            <CheckCircle2 className="size-8 text-green-500" />
            <p className="text-sm font-medium">メールを送りました</p>
            <p className="text-xs text-muted">{email} に届いたリンクをクリックしてログインできます</p>
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
            <p className="text-center text-xs text-muted">メールでログインリンクを受け取る</p>
          </div>
        )}
      </div>
    </div>
  );
}
