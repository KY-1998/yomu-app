// 投稿画面 - Supabase連携済み
"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RotateCcw } from "lucide-react";
import imageCompression from "browser-image-compression";
import { CATEGORIES, cn, jstToday, type CategoryKey } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type CellState = { previewUrl: string | null; file: File | null; caption: string; };
const emptyCell = (): CellState => ({ previewUrl: null, file: null, caption: "" });

export default function PostPage() {
  const supabase = createClient();
  const router = useRouter();
  const [cells, setCells] = useState<Record<CategoryKey, CellState>>({
    face: emptyCell(), scene: emptyCell(), weather: emptyCell(), food: emptyCell(),
  });
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<Partial<Record<CategoryKey, HTMLInputElement | null>>>({});
  const filledCount = CATEGORIES.filter((c) => cells[c.key].previewUrl).length;

  async function handleFileChange(key: CategoryKey, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await imageCompression(file, { maxWidthOrHeight: 1280, maxSizeMB: 0.3, useWebWorker: true });
    setCells((prev) => {
      if (prev[key].previewUrl) URL.revokeObjectURL(prev[key].previewUrl);
      return { ...prev, [key]: { file: compressed, previewUrl: URL.createObjectURL(compressed), caption: prev[key].caption } };
    });
    e.target.value = "";
  }

  function clearCell(key: CategoryKey) {
    setCells((prev) => {
      if (prev[key].previewUrl) URL.revokeObjectURL(prev[key].previewUrl);
      return { ...prev, [key]: emptyCell() };
    });
  }

  async function handleSubmit() {
    if (filledCount === 0 || submitting) return;
    setSubmitting(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const today = jstToday();
      const { data: post, error: postErr } = await supabase
        .from("posts")
        .upsert({ user_id: user.id, post_date: today, note: note.trim() }, { onConflict: "user_id,post_date" })
        .select("id").single();
      if (postErr || !post) throw new Error(postErr?.message ?? "投稿に失敗しました");
      const filled = CATEGORIES.filter((c) => cells[c.key].file);
      await Promise.all(filled.map(async (c) => {
        const key = c.key as CategoryKey;
        const path = `${user.id}/${today}/${key}.jpg`;
        const { error: upErr } = await supabase.storage.from("post-images")
          .upload(path, cells[key].file!, { upsert: true, contentType: "image/jpeg" });
        if (upErr) throw new Error(upErr.message);
        const { error: itemErr } = await supabase.from("post_items")
          .upsert({ post_id: post.id, category: key, image_url: path, caption: cells[key].caption }, { onConflict: "post_id,category" });
        if (itemErr) throw new Error(itemErr.message);
      }));
      router.push("/home");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map((cat) => {
          const cell = cells[cat.key];
          return (
            <div key={cat.key} className="flex flex-col gap-1.5">
              <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted/50">
                {cell.previewUrl ? (
                  <>
                    <img src={cell.previewUrl} alt={cat.label} className="size-full object-cover" />
                    <button
                      onClick={() => clearCell(cat.key)}
                      className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm"
                    >
                      <RotateCcw className="size-3.5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => inputRefs.current[cat.key]?.click()}
                    className="flex size-full flex-col items-center justify-center gap-2 text-muted transition-colors hover:text-foreground"
                  >
                    <span className="text-3xl">{cat.emoji}</span>
                    <span className="text-xs">{cat.label}</span>
                    <Plus className="size-4" />
                  </button>
                )}
                <input
                  ref={(el) => { inputRefs.current[cat.key] = el; }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFileChange(cat.key, e)}
                />
              </div>
              {cell.previewUrl && (
                <input
                  type="text"
                  placeholder={cat.hint}
                  value={cell.caption}
                  onChange={(e) => setCells((prev) => ({ ...prev, [cat.key]: { ...prev[cat.key], caption: e.target.value } }))}
                  className="rounded-lg border border-border bg-transparent px-3 py-1.5 text-xs placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
                />
              )}
            </div>
          );
        })}
      </div>

      <textarea
        placeholder="今日はどんな日でしたか？（任意）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        className="resize-none rounded-xl border border-border bg-transparent px-4 py-3 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      <Button
        onClick={handleSubmit}
        disabled={filledCount === 0 || submitting}
        className="w-full"
      >
        {submitting ? "投稿中..." : `投稿する（${filledCount}/4枚）`}
      </Button>
    </div>
  );
}
