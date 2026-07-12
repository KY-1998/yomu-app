// プロフィールページ
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES } from "@/lib/utils";

const CELL_GRADIENTS: Record<string, string> = {
  face: "linear-gradient(160deg, #D9BFB0, #C9A28F)",
  scene: "linear-gradient(160deg, #A8B5A0, #96A48D)",
  weather: "linear-gradient(160deg, #AEBFC9, #9DB0BD)",
  food: "linear-gradient(160deg, #D6B98C, #C7A76F)",
};

type PostSummary = {
  id: string;
  post_date: string;
  categories: string[];
  signedUrls: Record<string, string>;
};

type Profile = {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [avatarSignedUrl, setAvatarSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      // サーバー側の (app)/layout.tsx が認証チェック済みのため、
      // クライアント側で router.push せずそのままreturnする
      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("username, display_name, bio, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      setProfile(prof);

      if (prof?.avatar_url) {
        const { data: avu } = await supabase.storage
          .from("avatars")
          .createSignedUrl(prof.avatar_url, 3600);
        if (avu?.signedUrl) setAvatarSignedUrl(avu.signedUrl);
      }

      const { data: rawPosts } = await supabase
        .from("posts")
        .select("id, post_date, post_items(category, image_url)")
        .eq("user_id", user.id)
        .order("post_date", { ascending: false })
        .limit(12);

      if (rawPosts) {
        const enriched: PostSummary[] = await Promise.all(
          rawPosts.map(async (p: any) => {
            const signedUrls: Record<string, string> = {};
            await Promise.all(
              (p.post_items || []).map(async (item: any) => {
                if (item.image_url && !item.image_url.startsWith("http")) {
                  const { data } = await supabase.storage
                    .from("post-images")
                    .createSignedUrl(item.image_url, 3600);
                  if (data?.signedUrl) signedUrls[item.category] = data.signedUrl;
                } else if (item.image_url) {
                  signedUrls[item.category] = item.image_url;
                }
              })
            );
            return {
              id: p.id,
              post_date: p.post_date,
              categories: (p.post_items || []).map((i: any) => i.category),
              signedUrls,
            };
          })
        );
        setPosts(enriched);
      }

      const { count } = await supabase
        .from("friendships")
        .select("*", { count: "exact", head: true })
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq("status", "accepted");
      setFriendCount(count ?? 0);

      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = profile?.display_name || profile?.username || "—";
  const username = profile?.username || "";
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <div style={{ padding: "56px 0 0", minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "28px 24px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: avatarSignedUrl ? "transparent" : "linear-gradient(160deg, #D9BFB0, #C9A28F)",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", flexShrink: 0,
        }}>
          {avatarSignedUrl ? (
            <img src={avatarSignedUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ fontSize: 28, fontWeight: 500, color: "#FAF7F2", letterSpacing: "0.04em" }}>
              {initials}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: "0.12em", color: "#2B2B28" }}>
            {displayName.toUpperCase()}
          </span>
          {username && (
            <span style={{ fontSize: 10, color: "#B4AA98", letterSpacing: "0.12em" }}>@{username}</span>
          )}
        </div>

        <div style={{ display: "flex", gap: 32, marginTop: 4 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: "#2B2B28", letterSpacing: "0.06em" }}>
              {posts.length > 0 ? `${posts.length}+` : "0"}
            </span>
            <span style={{ fontSize: 9, color: "#A79D8C", letterSpacing: "0.16em" }}>投稿</span>
          </div>
          <div style={{ width: 1, background: "#EAE2D2" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span style={{ fontSize: 16, fontWeight: 500, color: "#2B2B28", letterSpacing: "0.06em" }}>{friendCount}</span>
            <span style={{ fontSize: 9, color: "#A79D8C", letterSpacing: "0.16em" }}>友達</span>
          </div>
        </div>

        <Link
          href="/profile/edit"
          style={{
            display: "block", width: "100%", border: "1px solid #DDD3C0", borderRadius: 9999,
            padding: "10px 0", textAlign: "center", fontSize: 12, fontWeight: 400,
            color: "#8A8375", letterSpacing: "0.14em", textDecoration: "none", marginTop: 4,
          }}
        >
          プロフィールを編集
        </Link>
      </div>

      <div style={{ height: 1, background: "#EAE2D2", margin: "0 24px" }} />

      <div style={{ padding: "20px 24px 0", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: "0.14em", color: "#2B2B28" }}>この投稿</span>
          <Link href="/history" style={{ fontSize: 10, color: "#A79D8C", letterSpacing: "0.12em", textDecoration: "none" }}>
            全て見る ›
          </Link>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "32px 0" }}>
            <span style={{ fontSize: 10, color: "#A79D8C", letterSpacing: "0.14em" }}>読み込み中…</span>
          </div>
        ) : posts.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 0", gap: 12 }}>
            <span style={{ fontSize: 11, color: "#B4AA98", letterSpacing: "0.1em" }}>まだ投稿がありません</span>
            <Link
              href="/post"
              style={{
                border: "1px solid #E8663C", color: "#E8663C", borderRadius: 9999,
                padding: "10px 24px", fontSize: 11, letterSpacing: "0.16em", textDecoration: "none",
              }}
            >
              最初の4コマを届ける
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
            {posts.map((post) => (
              <button
                key={post.id}
                onClick={() => router.push(`/post?date=${post.post_date}`)}
                style={{
                  aspectRatio: "1", padding: 0, border: "none", cursor: "pointer",
                  borderRadius: 3, overflow: "hidden", background: "transparent", position: "relative",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, width: "100%", height: "100%" }}>
                  {CATEGORIES.map(cat => {
                    const url = post.signedUrls[cat.key];
                    const hasCategory = post.categories.includes(cat.key);
                    return (
                      <div
                        key={cat.key}
                        style={{
                          width: "100%", height: "100%",
                          background: hasCategory ? CELL_GRADIENTS[cat.key] : "#EFEADF",
                          position: "relative", overflow: "hidden",
                        }}
                      >
                        {url && (
                          <img src={url} alt={cat.label}
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 1, background: "#EAE2D2", margin: "20px 24px 0" }} />

      <div style={{ padding: "0 24px" }}>
        <Link
          href="/invite"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 0", textDecoration: "none", color: "#2B2B28",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <circle cx="7" cy="7" r="3" stroke="#A79D8C" strokeWidth="1.2" />
              <path d="M1 17c0-3 2.5-5 6-5s6 2 6 5" stroke="#A79D8C" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M15 7v6M12 10h6" stroke="#E8663C" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 12, letterSpacing: "0.1em", color: "#8A8375" }}>友達を招待する</span>
          </div>
          <span style={{ color: "#C2B9A8", fontSize: 14 }}>›</span>
        </Link>
      </div>
    </div>
  );
}
