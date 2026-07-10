// プロフィールページ（インスタ風・初回登録 + 後から編集）
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, jstToday, type CategoryKey } from "@/lib/utils";

type Profile = { display_name: string; username: string };
type PostItem = { category: string; image_url: string };
type Post = { id: string; post_date: string; post_items: PostItem[] };

export default function ProfilePage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("id", user.id)
        .maybeSingle();

      if (p) {
        setProfile(p);
        setDisplayName(p.display_name ?? "");
        setUsername(p.username ?? "");
      } else {
        // 初回：編集モードで開く
        setIsEditing(true);
      }

      const { data: recentPosts } = await supabase
        .from("posts")
        .select("id, post_date, post_items(category, image_url)")
        .eq("user_id", user.id)
        .order("post_date", { ascending: false })
        .limit(6);
      if (recentPosts) setPosts(recentPosts as Post[]);

      const { count } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq("status", "accepted");
      setFriendCount(count ?? 0);

      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です");
      if (!displayName.trim()) throw new Error("表示名を入力してください");
      if (!/^[a-zA-Z0-9_]{1,30}$/.test(username))
        throw new Error("ユーザー名は英数字と_のみ（1〜30文字）");

      const { error: e } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
        updated_at: new Date().toISOString(),
      });
      if (e) throw e;

      // プロフィール設定完了フラグをメタデータに保存
      await supabase.auth.updateUser({ data: { profile_complete: true } });

      setProfile({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase(),
      });
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-sm text-muted-foreground">読み込み中…</p>
      </div>
    );
  }

  // ── 編集モード ──────────────────────────────
  if (isEditing) {
    return (
      <div className="flex flex-col max-w-sm mx-auto px-4 py-6 gap-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => profile && setIsEditing(false)}
            className="text-sm text-muted-foreground w-16"
          >
            {profile ? "キャンセル" : ""}
          </button>
          <h1 className="text-base font-semibold">
            {profile ? "プロフィールを編集" : "プロフィールを設定"}
          </h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm font-semibold text-accent disabled:opacity-40 w-16 text-right"
          >
            {saving ? "…" : "保存"}
          </button>
        </div>

        {/* アバタープレビュー */}
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center text-4xl font-medium text-accent">
            {displayName.charAt(0).toUpperCase() || "?"}
          </div>
        </div>

        {/* フォーム */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              表示名
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例: ゆーた"
              maxLength={30}
              className="border-b border-input pb-2 text-base outline-none focus:border-foreground bg-transparent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              ユーザー名
            </label>
            <div className="flex items-center gap-1 border-b border-input pb-2 focus-within:border-foreground">
              <span className="text-muted-foreground">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                  )
                }
                placeholder="yuta_1998"
                maxLength={30}
                className="flex-1 text-base outline-none bg-transparent"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              英数字とアンダースコア（_）のみ
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  // ── 表示モード（インスタ風） ────────────────────
  const initials = profile?.display_name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <div className="flex flex-col pb-4">
      {/* プロフィールヘッダー */}
      <div className="flex flex-col items-center gap-3 px-6 pt-6 pb-4">
        <div className="w-24 h-24 rounded-full bg-accent/20 flex items-center justify-center text-4xl font-semibold text-accent">
          {initials}
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold">{profile?.display_name}</p>
          <p className="text-sm text-muted-foreground">@{profile?.username}</p>
        </div>

        {/* 統計 */}
        <div className="flex gap-10 mt-1">
          <div className="flex flex-col items-center">
            <span className="text-base font-semibold">{posts.length > 0 ? posts.length + "+" : 0}</span>
            <span className="text-xs text-muted-foreground">投稿</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-base font-semibold">{friendCount}</span>
            <span className="text-xs text-muted-foreground">友達</span>
          </div>
        </div>

        {/* 編集ボタン */}
        <button
          onClick={() => setIsEditing(true)}
          className="w-full max-w-xs border border-input rounded-lg py-1.5 text-sm font-medium hover:bg-muted transition-colors"
        >
          プロフィールを編集
        </button>
      </div>

      {/* この投稿 */}
      <div className="border-t">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-sm font-semibold">この投稿</p>
          <Link
            href="/history"
            className="text-xs text-muted-foreground flex items-center gap-0.5"
          >
            全て見る <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            まだ投稿がありません
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {posts.map((post) => {
              const byCategory = Object.fromEntries(
                post.post_items.map((i) => [i.category, i])
              );
              // 代表画像は face → scene → weather → food の優先順
              const rep =
                byCategory["face"] ||
                byCategory["scene"] ||
                byCategory["weather"] ||
                byCategory["food"];
              return (
                <div
                  key={post.id}
                  className="aspect-square overflow-hidden bg-muted"
                >
                  {/* 2×2ミニグリッド */}
                  <div className="grid grid-cols-2 gap-px w-full h-full">
                    {CATEGORIES.map((cat) => {
                      const item = byCategory[cat.key];
                      return (
                        <div
                          key={cat.key}
                          className="overflow-hidden bg-muted-foreground/10"
                        >
                          {item?.image_url && (
                            <img
                              src={item.image_url}
                              alt={cat.label}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 友達を招待 */}
      <div className="border-t mt-4">
        <Link
          href="/invite"
          className="flex items-center justify-between px-4 py-4 hover:bg-muted transition-colors"
        >
          <div className="flex items-center gap-2 text-sm">
            <span>👥</span>
            <span>友達を招待する</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
