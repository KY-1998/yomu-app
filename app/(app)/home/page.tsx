"use client";
// タイムライン画面（Supabase連携済み）
import { useState, useEffect } from "react";
import Link from "next/link";
import { CATEGORIES, cn, jstToday, type CategoryKey } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

type PostData = {
  id: string;
  note: string;
  created_at: string;
  profiles: { username: string; display_name: string } | null;
  post_items: { category: string; image_url: string }[];
  reactions: { emoji: string; user_id: string }[];
  imageUrls: Record<string, string>;
};

export default function HomePage() {
  const supabase = createClient();
  const [hasPostedToday, setHasPostedToday] = useState(false);
  const [posts, setPosts] = useState<PostData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: posted } = await supabase.rpc("has_posted_today", { uid: user.id });
      setHasPostedToday(!!posted);
      const { data } = await supabase
        .from("posts")
        .select(`
          id, note, created_at,
          profiles!posts_user_id_fkey ( username, display_name ),
          post_items ( category, image_url ),
          reactions ( emoji, user_id )
        `)
        .eq("post_date", jstToday())
        .neq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        const withUrls = await Promise.all(
          data.map(async (post) => {
            const imageUrls: Record<string, string> = {};
            for (const item of post.post_items) {
              const { data: urlData } = await supabase.storage
                .from("post-images")
                .createSignedUrl(item.image_url, 3600);
              if (urlData) imageUrls[item.category] = urlData.signedUrl;
            }
            return { ...post, imageUrls };
          })
        );
        setPosts(withUrls as PostData[]);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aggregateReactions = (reactions: { emoji: string }[]) => {
    const counts: Record<string, number> = {};
    reactions.forEach((r) => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
    return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="font-latin text-xs tracking-[0.3em] text-muted">loading...</p>
      </div>
    );
  }
  return (
    <div className="px-5 pt-6">
      {!hasPostedToday && (
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link href="/post" className="ghost-btn font-heading text-foreground">
            今日を届ける →
          </Link>
        </div>
      )}
      {posts.length === 0 && (
        <p className="py-12 text-center text-sm text-muted">
          {hasPostedToday ? "友達がまだ投稿していません" : "投稿すると友達の今日が見えます"}
        </p>
      )}
      <div className="flex flex-col gap-10">
        {posts.map((post) => {
          const reactions = aggregateReactions(post.reactions);
          const author = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles;
          return (
            <article key={post.id}>
              <div className="mb-3 flex items-baseline justify-between">
                <p className="font-heading text-sm">{author?.display_name || author?.username}</p>
                <p className="text-right font-latin text-[10px] tracking-wide text-muted">
                  @{author?.username} ・ {new Date(post.created_at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" })}
                </p>
              </div>
              <div className="relative overflow-hidden rounded-xl">
                <div className={cn("grid grid-cols-2 gap-0.5 transition-[filter] duration-700", !hasPostedToday && "locked-blur")}>
                  {CATEGORIES.map((c) => {
                    const url = post.imageUrls[c.key];
                    return (
                      <div key={c.key} className="relative aspect-square overflow-hidden rounded-none bg-card">
                        {url ? (
                          <img src={url} alt={c.label} className="film-photo h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <span className="text-lg opacity-25">{c.emoji}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!hasPostedToday && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Link href="/post" className="ghost-btn font-heading text-foreground">投稿すると見れます</Link>
                  </div>
                )}
              </div>
              {post.note && hasPostedToday && (
                <p className="mt-3 text-[13px] leading-6">{post.note}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                {reactions.map((r) => (
                  <button key={r.emoji} className="flex items-center gap-1 rounded-full border border-foreground/10 bg-card px-2.5 py-1 text-xs transition-colors hover:border-foreground/30" disabled={!hasPostedToday}>
                    <span>{r.emoji}</span>
                    <span className="font-latin text-[11px] text-muted">{r.count}</span>
                  </button>
                ))}
                <button className="rounded-full border border-dashed border-foreground/10 px-2.5 py-1 text-xs text-muted transition-colors hover:border-foreground/30" disabled={!hasPostedToday}>＋</button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="py-12 text-center font-latin text-xs tracking-[0.3em] text-muted">— きょうはここまで —</p>
    </div>
  );
}
