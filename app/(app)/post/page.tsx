// 投稿画面 - 当日投稿編集対応
"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw } from "lucide-react";
import imageCompression from "browser-image-compression";
import { CATEGORIES, cn, jstToday, type CategoryKey } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type CellState = { previewUrl: string | null; file: File | null; caption: string };
const emptyCell = (): CellState => ({ previewUrl: null, file: null, caption: "" });

export default function PostPage() {
  const supabase = createClient();
  const router = useRouter();
  const [cells, setCells] = useState<Record<CategoryKey, CellState>>({
    face: emptyCell(),
    scene: emptyCell(),
    weather: emptyCell(),
    food: emptyCell(),
  });
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const inputRefs = useRef<Partial<Record<CategoryKey, HTMLInputElement | null>>>({});
  const filledCount = CATEGORIES.filter((c) => cells[c.key].previewUrl).length;

  // 当日の投稿があれば読み込む
  useEffect(() => {
    async function loadTodayPost() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const today = jstToday();

      const { data: post } = await supabase
        .from("posts")
        .select("id, note")
        .eq("user_id", user.id)
        .eq("post_date", today)
        .maybeSingle();

      if (!post) return;
      setIsEditMode(true);
      setNote(post.note ?? "");

      const { data: items } = await supabase
        .from("post_items")
        .select("category, image_url, caption")
        .eq("post_id", post.id);

      if (items) {
        setCells((prev) => {
          const next = { ...prev };
          items.forEach((item) => {
            next[item.category as CategoryKey] = {
              previewUrl: item.image_url,
              file: null,
              caption: item.caption ?? "",
            };
          });
          return next;
        });
      }
    }
    loadTodayPost();
  }, []);

  async function handleFileChange(
    key: CategoryKey,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCells((prev) => ({ ...prev, [key]: { ...prev[key], previewUrl, file } }));
    e.target.value = "";
  }

  function clearCell(key: CategoryKey) {
    setCells((prev) => ({ ...prev, [key]: emptyCell() }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインが必要です");
      const today = jstToday();

      const { data: post, error: postErr } = await supabase
        .from("posts")
        .upsert(
          { user_id: user.id, post_date: today, note: note.trim() },
          { onConflict: "user_id,post_date" }
        )
        .select("id")
        .single();
      if (postErr) throw postErr;

      const uploadResults = await Promise.all(
        CATEGORIES.map(async (cat) => {
          const cell = cells[cat.key];
          if (!cell.previewUrl) return null;

          let imageUrl = cell.previewUrl;

          // 新しいファイルを選んだときだけアップロード
          if (cell.file) {
            const compressed = await imageCompression(cell.file, {
              maxSizeMB: 0.5,
              maxWidthOrHeight: 1080,
              useWebWorker: true,
            });
            const path = `${user.id}/${today}/${cat.key}.jpg`;
            const { error: upErr } = await supabase.storage
              .from("post-images")
              .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
            if (upErr) throw upErr;
            const {
              data: { publicUrl },
            } = supabase.storage.from("post-images").getPublicUrl(path);
            imageUrl = publicUrl;
          }

          return {
            post_id: post!.id,
            category: cat.key,
            image_url: imageUrl,
            caption: cell.caption.trim(),
          };
        })
      );

      const items = uploadResults.filter(Boolean) as {
        post_id: string;
        category: string;
        image_url: string;
        caption: string;
      }[];

      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from("post_items")
          .upsert(items, { onConflict: "post_id,category" });
        if (itemsErr) throw itemsErr;
      }

      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-col items-center min-h-screen bg-background p-4 gap-4">
      <h1 className="text-lg font-semibold mt-2">
        {isEditMode ? "今日の投稿を編集" : "今日を記録する"}
      </h1>

      {/* 2×2 グリッド */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {CATEGORIES.map((cat) => {
          const cell = cells[cat.key];
          return (
            <div key={cat.key} className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground text-center">
                {cat.label}
              </span>
              <div
                className={cn(
                  "relative aspect-square rounded-xl overflow-hidden border-2 border-dashed",
                  cell.previewUrl
                    ? "border-transparent"
                    : "border-muted-foreground/30"
                )}
              >
                {cell.previewUrl ? (
                  <>
                    <img
                      src={cell.previewUrl}
                      alt={cat.label}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => clearCell(cat.key)}
                      className="absolute top-1 right-1 bg-black/50 rounded-full p-0.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-white" />
                    </button>
                  </>
                ) : (
                  <button
                    className="w-full h-full flex items-center justify-center"
                    onClick={() => inputRefs.current[cat.key]?.click()}
                  >
                    <Plus className="w-8 h-8 text-muted-foreground/50" />
                  </button>
                )}
                <input
                  ref={(el) => {
                    inputRefs.current[cat.key] = el;
                  }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileChange(cat.key, e)}
                />
              </div>
              <input
                type="text"
                placeholder="一言メモ"
                value={cell.caption}
                onChange={(e) =>
                  setCells((prev) => ({
                    ...prev,
                    [cat.key]: { ...prev[cat.key], caption: e.target.value },
                  }))
                }
                className="text-xs border rounded px-2 py-1 w-full"
                maxLength={50}
              />
            </div>
          );
        })}
      </div>

      {/* 全体メモ */}
      <textarea
        placeholder="今日のひとこと（任意）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full max-w-sm border rounded-lg px-3 py-2 text-sm resize-none"
        rows={2}
        maxLength={200}
      />

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={submitting || filledCount === 0}
        className="w-full max-w-sm"
      >
        {submitting
          ? "処理中…"
          : isEditMode
          ? `更新する (${filledCount}/4)`
          : `投稿する (${filledCount}/4)`}
      </Button>
    </main>
  );
}
