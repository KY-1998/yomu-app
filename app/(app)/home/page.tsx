// タイムライン画面のスケルトン（ダミーデータ）
// 相互主義: 自分が未投稿のあいだ、友達の投稿はぼかして表示する
"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES, cn, type CategoryKey } from "@/lib/utils";

// ---------- ダミーデータ（Supabase接続後に置き換え） ----------
type DummyPost = {
  id: string;
  name: string;
  username: string;
  time: string;
  note: string;
  items: Partial<Record<CategoryKey, { color: string; caption: string }>>;
  reactions: { emoji: string; count: number }[];
};

const DUMMY_POSTS: DummyPost[] = [
  {
    id: "1",
    name: "みなと",
    username: "minato_87",
    time: "12:24",
    note: "ゼミ終わりに海まで散歩した日。",
    items: {
      face: { color: "#d8c8b8", caption: "寝ぐせのまま" },
      scene: { color: "#b8c4c8", caption: "江ノ島ちょっと曇り" },
      weather: { color: "#c9d2d8", caption: "くもりのち晴れ" },
      food: { color: "#d8ccb0", caption: "しらす丼 ¥980" },
    },
    reactions: [
      { emoji: "🌊", count: 3 },
      { emoji: "🍚", count: 1 },
    ],
  },
  {
    id: "2",
    name: "はるか",
    username: "hrk_02",
    time: "08:51",
    note: "",
    items: {
      weather: { color: "#cfd8cd", caption: "朝の空、いい感じ" },
      food: { color: "#dcc8be", caption: "コンビニのホットラテ" },
    },
    reactions: [{ emoji: "☀️", count: 2 }],
  },
  {
    id: "3",
    name: "けんた",
    username: "kenta.jpg",
    time: "21:07",
    note: "残業だったけどラーメンで回復。",
    items: {
      face: { color: "#c8bcb0", caption: "" },
      food: { color: "#d4b8a0", caption: "家系。全部乗せ" },
    },
    reactions: [],
  },
];

export default function HomePage() {
  // TODO: Supabase から「自分が今日投稿済みか」を取得する
  const [hasPostedToday, setHasPostedToday] = useState(false);

  return (
    <div className="px-5 pt-6">
      {/* 未投稿時のCTA（相互主義の案内・ゴーストボタン1つだけ） */}
      {!hasPostedToday && (
        <div className="mb-8 flex flex-col items-center gap-3">
          <Link href="/post" className="ghost-btn font-heading text-foreground">
            今日を届ける →
          </Link>
          {/* 開発用: ぼかし解除のプレビュー */}
          <button
            onClick={() => setHasPostedToday(true)}
            className="text-[10px] text-muted underline underline-offset-2"
          >
            （開発用）投稿済みとして表示
          </button>
        </div>
      )}

      {/* 友達の投稿カード */}
      <div className="flex flex-col gap-10">
        {DUMMY_POSTS.map((post) => (
          <article key={post.id}>
            {/* 投稿者ヘッダー */}
            <div className="mb-3 flex items-baseline justify-between">
              <p className="font-heading text-sm">{post.name}</p>
              <p className="text-right font-latin text-[10px] tracking-wide text-muted">
                @{post.username} ・ {post.time}
              </p>
            </div>

            {/* 2×2 グリッド */}
            <div className="relative overflow-hidden rounded-xl">
              <div
                className={cn(
                  "grid grid-cols-2 gap-0.5 transition-[filter] duration-700",
                  !hasPostedToday && "locked-blur"
                )}
              >
                {CATEGORIES.map((c) => {
                  const item = post.items[c.key];
                  return (
                    <div
                      key={c.key}
                      className="relative aspect-square overflow-hidden rounded-none bg-card"
                    >
                      {item ? (
                        <>
                          {/* 画像プレースホルダ（Supabase Storage接続後に <Image> へ） */}
                          <div
                            className="film-photo absolute inset-0"
                            style={{
                              background: `linear-gradient(135deg, ${item.color}, ${item.color}cc 60%, #00000014)`,
                            }}
                          />
                          {item.caption && (
                            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-2.5 pb-2 pt-6 text-[11px] leading-4 text-white/95">
                              {item.caption}
                            </p>
                          )}
                        </>
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-lg opacity-25">{c.emoji}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ロック時のオーバーレイ（ゴーストボタン） */}
              {!hasPostedToday && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Link
                    href="/post"
                    className="ghost-btn font-heading text-foreground"
                  >
                    投稿すると見れます
                  </Link>
                </div>
              )}
            </div>

            {/* ノート＆リアクション */}
            {post.note && hasPostedToday && (
              <p className="mt-3 text-[13px] leading-6">{post.note}</p>
            )}
            <div className="mt-3 flex items-center gap-2">
              {post.reactions.map((r) => (
                <button
                  key={r.emoji}
                  className="flex items-center gap-1 rounded-full border border-foreground/10 bg-card px-2.5 py-1 text-xs transition-colors hover:border-foreground/30"
                  disabled={!hasPostedToday}
                >
                  <span>{r.emoji}</span>
                  <span className="font-latin text-[11px] text-muted">
                    {r.count}
                  </span>
                </button>
              ))}
              <button
                className="rounded-full border border-dashed border-foreground/10 px-2.5 py-1 text-xs text-muted transition-colors hover:border-foreground/30"
                disabled={!hasPostedToday}
              >
                ＋
              </button>
            </div>
          </article>
        ))}
      </div>

      <p className="py-12 text-center font-latin text-xs tracking-[0.3em] text-muted">
        — きょうはここまで —
      </p>
    </div>
  );
}
