"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Copy, Check, Users, Search, UserPlus, Clock, X } from "lucide-react";

type Invite = { code: string; expires_at: string; used_by: string | null };
type FriendProfile = { id: string; display_name: string | null; username: string | null };
type SearchResult = FriendProfile & { rel: "friend" | "pending_sent" | "pending_received" | "none" };
type PendingRequest = FriendProfile & { friendship_id: string };

function randomCode(len = 8) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32])
    .join("");
}

export default function InvitePage() {
  const supabase = createClient();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [pendingIn, setPendingIn] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 招待リンク
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

      // フレンドシップ一覧
      const { data: allFs } = await supabase
        .from("friendships")
        .select("id, user_a, user_b, requested_by, status")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);

      const accepted = (allFs ?? []).filter(f => f.status === "accepted");
      const pendingReceived = (allFs ?? []).filter(
        f => f.status === "pending" && f.requested_by !== user.id
      );

      // 友達プロフィール
      if (accepted.length > 0) {
        const ids = accepted.map(f => f.user_a === user.id ? f.user_b : f.user_a);
        const { data: profiles } = await supabase
          .from("profiles").select("id, display_name, username").in("id", ids);
        if (profiles) setFriends(profiles);
      } else {
        setFriends([]);
      }

      // 届いたリクエスト
      if (pendingReceived.length > 0) {
        const ids = pendingReceived.map(f => f.requested_by);
        const { data: profiles } = await supabase
          .from("profiles").select("id, display_name, username").in("id", ids);
        if (profiles) {
          setPendingIn(profiles.map(p => ({
            ...p,
            friendship_id: pendingReceived.find(f => f.requested_by === p.id)!.id,
          })));
        }
      } else {
        setPendingIn([]);
      }

      setLoading(false);
    })();
  }, [refreshKey]);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.trim().length < 1) { setSearchResults([]); return; }
    setSearching(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: results }, { data: myFs }] = await Promise.all([
      supabase.from("profiles")
        .select("id, display_name, username")
        .neq("id", user.id)
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(10),
      supabase.from("friendships")
        .select("id, user_a, user_b, requested_by, status")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
    ]);

    const enriched: SearchResult[] = (results ?? []).map(p => {
      const fs = (myFs ?? []).find(f => f.user_a === p.id || f.user_b === p.id);
      let rel: SearchResult["rel"] = "none";
      if (fs) {
        if (fs.status === "accepted") rel = "friend";
        else if (fs.requested_by === user.id) rel = "pending_sent";
        else rel = "pending_received";
      }
      return { ...p, rel };
    });

    setSearchResults(enriched);
    setSearching(false);
  }

  async function handleSendRequest(targetId: string) {
    await supabase.rpc("send_friend_request", { target_id: targetId });
    setSearchResults(prev =>
      prev.map(r => r.id === targetId ? { ...r, rel: "pending_sent" } : r)
    );
  }

  async function handleAccept(friendshipId: string) {
    await supabase.from("friendships")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", friendshipId);
    setRefreshKey(k => k + 1);
  }

  async function handleReject(friendshipId: string) {
    await supabase.rpc("reject_friend_request", { friendship_id: friendshipId });
    setPendingIn(prev => prev.filter(p => p.friendship_id !== friendshipId));
  }

  async function handleCopy() {
    if (!invite) return;
    await navigator.clipboard.writeText(`${window.location.origin}/join/${invite.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="flex h-60 items-center justify-center text-muted text-sm">読み込み中...</div>;

  return (
    <div className="flex flex-col gap-8 p-4">
      {/* 招待リンク */}
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

      {/* ユーザー検索 */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium tracking-wide text-muted">
          <Search className="size-4" /> ユーザーを探す
        </h2>
        <input
          type="text"
          value={searchQuery}
          onChange={e => handleSearch(e.target.value)}
          placeholder="名前またはユーザー名で検索"
          className="w-full rounded-xl border border-border bg-muted/10 px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        {searching && <p className="text-xs text-muted">検索中...</p>}
        {searchResults.length > 0 && (
          <ul className="flex flex-col gap-2">
            {searchResults.map(r => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl bg-muted/20 px-4 py-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
                  {r.display_name?.[0] ?? "?"}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.display_name ?? "名無し"}</p>
                  <p className="text-xs text-muted">@{r.username ?? "unknown"}</p>
                </div>
                {r.rel === "none" && (
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleSendRequest(r.id)}>
                    <UserPlus className="size-3" /> 追加
                  </Button>
                )}
                {r.rel === "pending_sent" && (
                  <span className="flex items-center gap-1 text-xs text-muted">
                    <Clock className="size-3" /> 申請中
                  </span>
                )}
                {r.rel === "pending_received" && (
                  <span className="text-xs text-accent font-medium">リクエストあり↓</span>
                )}
                {r.rel === "friend" && (
                  <span className="text-xs text-muted">友達</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 届いたリクエスト */}
      {pendingIn.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium tracking-wide text-muted">
            <UserPlus className="size-4" /> リクエスト ({pendingIn.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {pendingIn.map(r => (
              <li key={r.id} className="flex items-center gap-3 rounded-xl bg-muted/20 px-4 py-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-accent/20 text-sm font-medium text-accent">
                  {r.display_name?.[0] ?? "?"}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.display_name ?? "名無し"}</p>
                  <p className="text-xs text-muted">@{r.username ?? "unknown"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="text-xs" onClick={() => handleAccept(r.friendship_id)}>
                    承認
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs px-2" onClick={() => handleReject(r.friendship_id)}>
                    <X className="size-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 友達リスト */}
      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium tracking-wide text-muted">
          <Users className="size-4" /> 友達 ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-muted">まだ友達がいません。検索して追加してみよう！</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {friends.map(f => (
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
