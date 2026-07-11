"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, Check, Users } from "lucide-react";

type Invite = { code: string; expires_at: string; used_by: string | null };
type FriendProfile = { id: string; display_name: string | null; username: string | null };

function randomCode(len = 8) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32])
    .join("");
}

export default function InvitePage() {
  const supabase = createClient();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load existing valid invite or create one
      const { data: existing } = await supabase
        .from("invites")
        .select("code, expires_at, used_by")
        .eq("created_by", user.id)
        .is("used_by", null)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setInvite(existing);
      } else {
        const code = randomCode();
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: created } = await supabase
          .from("invites")
          .insert({ created_by: user.id, code, expires_at: expires })
          .select("code, expires_at, used_by")
          .single();
        if (created) setInvite(created);
      }

      // Step 1: get friend IDs from friendships (no nested joins to avoid dual-FK 400 error)
      const { data: friendships } = await supabase
        .from("friendships")
        .select("user_a, user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq("status", "accepted");

      if (friendships && friendships.length > 0) {
        // Step 2: collect friend IDs (the side that is not the current user)
        const friendIds = friendships.map((f) =>
          f.user_a === user.id ? f.user_b : f.user_a
        );

        // Step 3: fetch their profiles (RLS allows since we're friends)
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, username")
          .in("id", friendIds);

        if (profiles) setFriends(profiles);
      }

      setLoading(false);
    })();
  }, []);

  async function handleCopy() {
    if (!invite) return;
    const link = `${window.location.origin}/join/${invite.code}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="flex h-60 items-center justify-center text-muted text-sm">読み込み中...</div>;

  return (
    <div className="flex flex-col gap-8 p-4">
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium tracking-wide text-muted">友達を招待する</h2>
        {invite ? (
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/20 p-4">
            <p className="text-center font-mono text-2xl font-bold tracking-[0.2em] text-foreground">
              {invite.code}
            </p>
            <p className="text-center text-xs text-muted">
              有効期限: {new Date(invite.expires_at).toLocaleDateString("ja-JP")}
            </p>
            <Button onClick={handleCopy} variant="outline" className="gap-2">
              {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
              {copied ? "コピーしました！" : "招待リンクをコピー"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted">招待コードを生成できませんでした</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium tracking-wide text-muted">
          <Users className="size-4" /> 友達 ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-muted">まだ友達がいません。招待リンクを送ってみよう！</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-xl bg-muted/20 px-4 py-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
                  {f.display_name?.[0] ?? "?"}
                </div>
                <div>
                  <p className="text-sm font-medium">{f.display_name ?? "名無し"}</p>
                  <p className="text-xs text-muted">@{f.username ?? "unknown"}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
