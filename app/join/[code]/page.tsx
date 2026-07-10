"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { UserPlus, CheckCircle2, XCircle } from "lucide-react";

type Status = "loading" | "ready" | "success" | "already_friends" | "own_invite" | "expired" | "error" | "not_logged_in";

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const supabase = createClient();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus("not_logged_in"); return; }

      const { data: invite } = await supabase
        .from("invites")
        .select("created_by, used_by, expires_at, profiles!invites_created_by_fkey(display_name)")
        .eq("code", code)
        .maybeSingle();

      if (!invite) { setStatus("expired"); return; }
      if (new Date(invite.expires_at) < new Date()) { setStatus("expired"); return; }
      if (invite.created_by === user.id) { setStatus("own_invite"); return; }
      if (invite.used_by) { setStatus("expired"); return; }

      setInviterName((invite.profiles as any)?.display_name ?? "だれか");
      setStatus("ready");
    })();
  }, [code]);

  async function handleAccept() {
    setSubmitting(true);
    const { error } = await supabase.rpc("redeem_invite", { code: code });
    if (!error) {
      setStatus("success");
      setTimeout(() => router.push("/home"), 1500);
    } else if (error.message?.includes("already")) {
      setStatus("already_friends");
    } else {
      setStatus("error");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <p className="font-latin text-3xl font-bold tracking-tight">yomu</p>

      {status === "loading" && (
        <p className="text-sm text-muted">確認中...</p>
      )}

      {status === "not_logged_in" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-foreground">友達からの招待リンクです。</p>
          <p className="text-sm text-muted">まずGoogleでログインして、<br />もう一度このURLにアクセスしてください。</p>
          <Button onClick={() => router.push("/")}>ログインページへ</Button>
        </div>
      )}

      {status === "ready" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-accent/20">
            <UserPlus className="size-8 text-accent" />
          </div>
          <div>
            <p className="text-lg font-medium">{inviterName} さんからの招待</p>
            <p className="mt-1 text-sm text-muted">友達になりますか？</p>
          </div>
          <Button onClick={handleAccept} disabled={submitting} className="w-full max-w-xs">
            {submitting ? "処理中..." : "友達になる"}
          </Button>
        </div>
      )}

      {status === "success" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-12 text-green-500" />
          <p className="font-medium">友達になりました！</p>
          <p className="text-sm text-muted">ホームに移動中...</p>
        </div>
      )}

      {status === "already_friends" && (
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-12 text-accent" />
          <p className="font-medium">すでに友達です</p>
          <Button onClick={() => router.push("/home")}>ホームへ</Button>
        </div>
      )}

      {(status === "own_invite" || status === "expired" || status === "error") && (
        <div className="flex flex-col items-center gap-4 text-center">
          <XCircle className="size-12 text-red-400" />
          <p className="text-sm text-muted">
            {status === "own_invite" ? "自分の招待コードは使えません" :
             status === "expired" ? "この招待リンクは無効または期限切れです" :
             "エラーが発生しました"}
          </p>
          <Button variant="outline" onClick={() => router.push("/")}>トップへ</Button>
        </div>
      )}
    </div>
  );
}
