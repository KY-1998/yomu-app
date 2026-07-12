// きろく画面 - 月別カレンダー表示
"use client";
import { useState, useEffect, useCallback } from "react";
import { CATEGORIES } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const CELL_GRADIENTS: Record<string, string> = {
  face: "linear-gradient(160deg, #D9BFB0, #C9A28F)",
  scene: "linear-gradient(160deg, #A8B5A0, #96A48D)",
  weather: "linear-gradient(160deg, #AEBFC9, #9DB0BD)",
  food: "linear-gradient(160deg, #D6B98C, #C7A76F)",
};
const CELL_TEXTURE = "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 7px, rgba(43,43,40,0.03) 7px 14px)";

type PostItem = { category: string; image_url: string; signedUrl?: string };
type DayPost = {
  post_id: string;
  categories: string[];
  items: PostItem[];
};
type PostDetail = {
  date: string;
  note: string | null;
  items: PostItem[];
};

function toJSTDate() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}
function padZ(n: number) { return String(n).padStart(2, "0"); }
function makeDateStr(y: number, m: number, d: number) {
  return `${y}-${padZ(m + 1)}-${padZ(d)}`;
}
function formatDateJP(ds: string) {
  const [, m, d] = ds.split("-");
  return `${parseInt(m)}月${parseInt(d)}日`;
}

const DAY_HEADERS = ["S", "M", "T", "W", "T", "F", "S"];

export default function HistoryPage() {
  const jstNow = toJSTDate();
  const todayStr = makeDateStr(jstNow.getFullYear(), jstNow.getMonth(), jstNow.getDate());

  const [year, setYear] = useState(jstNow.getFullYear());
  const [month, setMonth] = useState(jstNow.getMonth());
  const [postsByDate, setPostsByDate] = useState<Record<string, DayPost>>({});
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // モーダル
  const [selectedPost, setSelectedPost] = useState<PostDetail | null>(null);

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const lastDay = new Date(y, m + 1, 0).getDate();
    const start = makeDateStr(y, m, 1);
    const end = makeDateStr(y, m, lastDay);

    const { data: posts } = await supabase
      .from("posts")
      .select("id, post_date, post_items(category, image_url)")
      .eq("user_id", user.id)
      .gte("post_date", start)
      .lte("post_date", end);

    if (posts && posts.length > 0) {
      // 全画像パスをまとめて signed URL 取得
      const allPaths = posts.flatMap((p: any) =>
        (p.post_items || []).map((i: any) => i.image_url)
      );
      const { data: signedData } = await supabase.storage
        .from("post-images")
        .createSignedUrls(allPaths, 3600);
      const urlMap = Object.fromEntries(
        (signedData || []).map((u: any) => [u.path, u.signedUrl])
      );

      const map: Record<string, DayPost> = {};
      posts.forEach((p: any) => {
        const items: PostItem[] = (p.post_items || []).map((i: any) => ({
          category: i.category,
          image_url: i.image_url,
          signedUrl: urlMap[i.image_url],
        }));
        map[p.post_date] = {
          post_id: p.id,
          categories: items.map(i => i.category),
          items,
        };
      });
      setPostsByDate(map);
    } else {
      setPostsByDate({});
    }

    const nowY = jstNow.getFullYear();
    const nowM = jstNow.getMonth();
    if (y === nowY && m === nowM) {
      const past90 = new Date(jstNow);
      past90.setDate(past90.getDate() - 90);
      const streakStart = makeDateStr(past90.getFullYear(), past90.getMonth(), past90.getDate());
      const { data: allPosts } = await supabase
        .from("posts").select("post_date")
        .eq("user_id", user.id)
        .gte("post_date", streakStart).lte("post_date", todayStr);
      if (allPosts) {
        const dateSet = new Set(allPosts.map((p: any) => p.post_date));
        let s = 0;
        const d = new Date(jstNow);
        while (s < 90) {
          const ds = makeDateStr(d.getFullYear(), d.getMonth(), d.getDate());
          if (dateSet.has(ds)) { s++; d.setDate(d.getDate() - 1); } else break;
        }
        setStreak(s);
      }
    }
    setLoading(false);
  }, [todayStr]);

  useEffect(() => { loadMonth(year, month); }, [year, month, loadMonth]);

  function openPost(ds: string) {
    const post = postsByDate[ds];
    if (!post) return;
    setSelectedPost({ date: ds, note: null, items: post.items });
  }

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };
  const isCurrentMonth = year === jstNow.getFullYear() && month === jstNow.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay();

  const itemsByCategory = selectedPost
    ? Object.fromEntries(selectedPost.items.map(i => [i.category, i]))
    : {};

  return (
    <div style={{ padding: "84px 24px 32px", minHeight: "100%", display: "flex", flexDirection: "column", gap: 32 }}>
      {/* マストヘッド */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontSize: 40, fontWeight: 500, letterSpacing: "0.06em", lineHeight: 1.1 }}>
          {month + 1}月の<br />きろく
        </span>
        {streak > 0 ? (
          <span style={{ fontSize: 11, letterSpacing: "0.08em", color: "#A79D8C" }}>
            <span style={{ color: "#E8663C", fontWeight: 500 }}>{streak}日</span>連続投稿中
          </span>
        ) : (
          <span style={{ fontSize: 11, letterSpacing: "0.08em", color: "#A79D8C" }}>
            {loading ? "読み込み中…" : "投稿した日がカレンダーに残ります"}
          </span>
        )}
      </div>

      {/* 月ナビ */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={prevMonth} style={{ background: "none", border: "none", cursor: "pointer", color: "#A79D8C", fontSize: 20, padding: "0 12px", lineHeight: 1, fontFamily: "var(--font-instrument), sans-serif" }}>‹</button>
        <span style={{ fontSize: 12, fontWeight: 400, letterSpacing: "0.16em", color: "#2B2B28", fontFamily: "var(--font-instrument), sans-serif" }}>{year}.{padZ(month + 1)}</span>
        <button onClick={nextMonth} disabled={isCurrentMonth} style={{ background: "none", border: "none", cursor: isCurrentMonth ? "default" : "pointer", color: isCurrentMonth ? "#DDD3C0" : "#A79D8C", fontSize: 20, padding: "0 12px", lineHeight: 1, fontFamily: "var(--font-instrument), sans-serif" }}>›</button>
      </div>

      {/* カレンダー */}
      <div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 8 }}>
          {DAY_HEADERS.map((d, i) => (
            <span key={i} style={{ textAlign: "center", fontSize: 8, fontFamily: "var(--font-instrument), sans-serif", letterSpacing: "0.1em", color: "#C2B9A8" }}>{d}</span>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} style={{ aspectRatio: "1" }} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const ds = makeDateStr(year, month, day);
            const post = postsByDate[ds];
            const isToday = ds === todayStr;
            const isFuture = ds > todayStr;
            return (
              <div
                key={ds}
                onClick={() => post && openPost(ds)}
                style={{
                  aspectRatio: "1",
                  cursor: post ? "pointer" : "default",
                  borderRadius: 3,
                  overflow: "hidden",
                  boxShadow: isToday ? "0 0 0 1.5px #E8663C" : "none",
                  position: "relative",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 1, width: "100%", height: "100%" }}>
                  {CATEGORIES.map(cat => {
                    const item = post?.items.find((it: PostItem) => it.category === cat.key);
                    const bg = post
                      ? CELL_GRADIENTS[cat.key]
                      : isFuture
                      ? "#F5F1EA"
                      : "#EFEADF";
                    return (
                      <div
                        key={cat.key}
                        style={{
                          position: "relative",
                          overflow: "hidden",
                          background: bg,
                          outline: isFuture ? "0.5px solid #E8E0D2" : "none",
                          outlineOffset: "-0.5px",
                          width: "100%",
                          height: "100%",
                        }}
                      >
                        {item?.signedUrl && (
                          <img src={item.signedUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 凡例 */}
      <div style={{ display: "flex", gap: 20, alignItems: "center", paddingTop: 8 }}>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <div style={{ width: 14, height: 14, borderRadius: 2, background: "linear-gradient(160deg, #D9BFB0, #C9A28F)" }} />
          <span style={{ fontSize: 9, color: "#A79D8C", letterSpacing: "0.12em" }}>とうこうした日</span>
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          <div style={{ width: 14, height: 14, borderRadius: 2, background: "#EFEADF" }} />
          <span style={{ fontSize: 9, color: "#A79D8C", letterSpacing: "0.12em" }}>おやすみ</span>
        </div>
      </div>

      {/* 写真モーダル */}
      {selectedPost && (
        <div
          onClick={() => setSelectedPost(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(43,43,40,0.55)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#FAF7F2",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 480,
              paddingBottom: "env(safe-area-inset-bottom, 24px)",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px" }}>
              <span style={{ fontSize: 14, fontWeight: 500, letterSpacing: "0.08em" }}>{formatDateJP(selectedPost.date)}</span>
              <button onClick={() => setSelectedPost(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#A79D8C", fontSize: 20, lineHeight: 1, padding: 4 }}>×</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              {CATEGORIES.map(c => {
                const item = itemsByCategory[c.key];
                return (
                  <div key={c.key} style={{ aspectRatio: "1", position: "relative", overflow: "hidden", background: item ? `${CELL_TEXTURE}, ${CELL_GRADIENTS[c.key]}` : "#EAE2D2" }}>
                    {item?.signedUrl && <img src={item.signedUrl} alt={c.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    {item && <span style={{ position: "absolute", top: 10, left: 10, fontSize: 8, letterSpacing: "0.28em", color: "rgba(250,247,242,0.95)", fontWeight: 500, textShadow: "0 0 8px rgba(43,43,40,0.3)" }}>{c.label}</span>}
                  </div>
                );
              })}
            </div>
            {selectedPost.note && (
              <div style={{ padding: "16px 24px" }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 300, lineHeight: 2, color: "#6E675C", letterSpacing: "0.04em" }}>{selectedPost.note}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
