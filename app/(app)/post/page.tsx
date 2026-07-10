// 投稿画面のスケルトン
// 2×2グリッド（顔・景色・天気・ご飯）。各セルタップでカメラ起動。部分投稿OK。
"use client";

import { useRef, useState } from "react";
import { Plus, RotateCcw } from "lucide-react";
import imageCompression from "browser-image-compression";
import { CATEGORIES, cn, jstToday, type CategoryKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type CellState = {
  previewUrl: string | null; // ObjectURL（アップロード前プレビュー）
  file: File | null;
  caption: string;
};

const emptyCell = (): CellState => ({
  previewUrl: null,
  file: null,
  caption: "",
});

export default function PostPage() {
  const [cells, setCells] = useState<Record<CategoryKey, CellState>>({
    face: emptyCell(),
    scene: emptyCell(),
    weather: emptyCell(),
    food: emptyCell(),
  });
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<Partial<Record<CategoryKey, HTMLInputElement | null>>>({});

  const filledCount = CATEGORIES.filter((c) => cells[c.key].previewUrl).length;

  // 写真選択 → 圧縮 → プレビュー表示
  async function handleFileChange(
    key: CategoryKey,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    // フィルム風SNSなので長辺1280px / 300KB程度まで圧縮（通信量にやさしく）
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 1280,
      maxSizeMB: 0.3,
      useWebWorker: true,
    });

    setCells((prev) => {
      // 古いObjectURLを解放
      if (prev[key].previewUrl) URL.revokeObjectURL(prev[key].previewUrl);
      return {
        ...prev,
        [key]: {
          ...prev[key],
          file: compressed,
          previewUrl: URL.createObjectURL(compressed),
        },
      };
    });
    e.target.value = ""; // 同じファイルを再選択できるように
  }

  function clearCell(key: CategoryKey) {
    setCells((prev) => {
      if (prev[key].previewUrl) URL.revokeObjectURL(prev[key].previewUrl);
      return { ...prev, [key]: emptyCell() };
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    // TODO: Supabase Storage へアップロード → posts / post_items を upsert
    // パス規約: post-images/{user_id}/{post_date}/{category}.jpg
    await new Promise((r) => setTimeout(r, 800)); // 仮の待ち
    setSubmitting(false);
    alert("（仮）投稿しました！Supabase接続後に実装します");
  }

  return (
    <div className="px-5 pt-6">
      <div className="mb-6">
        <h1 className="font-heading text-2xl">きょうの4枚</h1>
        <p className="mt-1 font-latin text-[10px] tracking-[0.15em] text-muted">
          {jstToday()} ・ 撮り直しは今日中なら何度でも
        </p>
      </div>

      {/* 2×2 撮影グリッド */}
      <div className="grid grid-cols-2 gap-2">
        {CATEGORIES.map((c) => {
          const cell = cells[c.key];
          const filled = !!cell.previewUrl;
          return (
            <div key={c.key} className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => inputRefs.current[c.key]?.click()}
                className={cn(
                  "relative aspect-square w-full overflow-hidden rounded-xl transition-all active:scale-[0.98]",
                  filled
                    ? "shadow-sm"
                    : "border border-dashed border-muted-soft/50 bg-card hover:border-muted-soft"
                )}
              >
                {filled ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={cell.previewUrl!}
                      alt={c.label}
                      className="film-photo absolute inset-0 h-full w-full object-cover"
                    />
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        clearCell(c.key);
                      }}
                      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/45 text-white"
                      aria-label={`${c.label}を撮り直す`}
                    >
                      <RotateCcw className="size-3.5" strokeWidth={2} />
                    </span>
                  </>
                ) : (
                  // 空きセル: 点線＋淡いアイコン（部分投稿OKの表現）
                  <span className="flex h-full flex-col items-center justify-center gap-2">
                    <span className="text-2xl opacity-30">{c.emoji}</span>
                    <Plus className="size-4 text-muted/50" strokeWidth={1.6} />
                  </span>
                )}
              </button>

              {/* カメラ起動用 input（スマホでは撮影が立ち上がる） */}
              <input
                ref={(el) => {
                  inputRefs.current[c.key] = el;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => handleFileChange(c.key, e)}
              />

              {/* キャプション（撮影済みのときだけ） */}
              {filled && (
                <input
                  type="text"
                  value={cell.caption}
                  maxLength={140}
                  placeholder={c.hint}
                  onChange={(e) =>
                    setCells((prev) => ({
                      ...prev,
                      [c.key]: { ...prev[c.key], caption: e.target.value },
                    }))
                  }
                  className="w-full rounded-none border-b border-muted-soft bg-transparent px-1 py-2 text-xs outline-none placeholder:text-muted/60 focus:border-foreground/40"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* ひとことノート */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="きょうのひとこと（任意）"
        className="mt-5 w-full resize-none rounded-none border-b border-muted-soft bg-transparent px-1 py-3 text-sm leading-6 outline-none placeholder:text-muted/60 focus:border-foreground/40"
      />

      {/* 投稿ボタン */}
      <div className="mt-6">
        <Button
          size="lg"
          className="w-full rounded-full"
          disabled={filledCount === 0 || submitting}
          onClick={handleSubmit}
        >
          {submitting
            ? "とどけています…"
            : filledCount === 0
              ? "まず1枚撮ってみよう"
              : `${filledCount}枚でとどける`}
        </Button>
        <p className="mt-3 text-center text-[10px] leading-5 tracking-[0.05em] text-muted">
          1枚だけでもOK。投稿すると友達の今日が見えるようになります。
        </p>
      </div>
    </div>
  );
}
