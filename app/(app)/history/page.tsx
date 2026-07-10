// 過去の投稿一覧
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORIES, jstToday, type CategoryKey } from "@/lib/utils";

type PostItem = { category: string; image_url: string; caption: string };
type Post = {
  id: string;
  post_date: string;
  note: string | null;
  post_items: PostItem[];
};

export default function HistoryPage() {
  const supabase = createClient();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("posts")
        .select("id, post_date, note, post_items(category, image_url, caption)")
        .eq("user_id", user.id)
        .lt("post_date", jstToday())
        .order("post_date", { ascending: false })
        .limit(60);

      if (data) setPosts(data as Post[]);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground text-sm">読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* ヘッダー */}
      <div className="sticky top-[64px] bg-background/80 backdrop-blur z-10 flex items-center gap-2 px-4 py-3 border-b">
        <button
          onClick={() => router.back()}
          className="p-1 -ml-1 rounded-full hover:bg-muted"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold">過去の投稿</h1>
        <span className="ml-auto text-xs text-muted-foreground">{posts.length}件</span>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
          <p className="text-sm">まだ記録がありません</p>
          <p className="text-xs">毎日カメラで投稿すると履歴が貯まります</p>
        </div>
      ) : (
        <div className="divide-y">
          {posts.map((post) => {
            const byCategory = Object.fromEntries(
              post.post_items.map((i) => [i.category, i])
            );
            const d = new Date(post.post_date + "T00:00:00+09:00");
            const dateStr = new Intl.DateTimeFormat("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
            }).format(d);

            return (
              <div key={post.id} className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  {dateStr}
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {CATEGORIES.map((cat) => {
                    const item = byCategory[cat.key];
                    return (
                      <div key={cat.key} className="flex flex-col gap-0.5">
                        <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                          {item?.image_url ? (
                            <img
                              src={item.image_url}
                              alt={cat.label}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground/50">
                              —
                            </div>
                          )}
                        </div>
                        <p className="text-[10px] text-center text-muted-foreground truncate">
                          {cat.label}
                        </p>
                        {item?.caption && (
                          <p className="text-[10px] text-center text-foreground/70 truncate">
                            {item.caption}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {post.note && (
                  <p className="mt-2 text-xs text-muted-foreground italic">
                    {post.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
