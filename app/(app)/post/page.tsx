// æç¨¿ç»é¢ - å½æ¥ & éå»æ¥ä»ç·¨éå¯¾å¿
"use client";
import { Suspense, useRef, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import imageCompression from "browser-image-compression";
import { CATEGORIES, jstToday, type CategoryKey } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ã«ãã´ãªãã¨ã®ã°ã©ãã¼ã·ã§ã³
const CELL_GRADIENTS: Record<string, string> = {
  face: "linear-gradient(160deg, #D9BFB0, #C9A28F)",
  scene: "linear-gradient(160deg, #A8B5A0, #96A48D)",
  weather: "linear-gradient(160deg, #AEBFC9, #9DB0BD)",
  food: "linear-gradient(160deg, #D6B98C, #C7A76F)",
};

const CELL_TEXTURE =
  "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 7px, rgba(43,43,40,0.03) 7px 14px)";

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3.5" width="6" height="3.5" rx="1.2" stroke="#CDC4B2" strokeWidth="1.2" />
      <rect x="3" y="6.5" width="18" height="13.5" rx="2.5" stroke="#CDC4B2" strokeWidth="1.2" />
      <circle cx="12" cy="13" r="3.5" stroke="#CDC4B2" strokeWidth="1.2" />
    </svg>
  );
}

type CellState = {
  file: File | null;
  previewUrl: string | null;
  caption: string;
};

const emptyCell = (): CellState => ({ file: null, previewUrl: null, caption: "" });

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00+09:00");
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  })
    .format(d)
    .replace(/\//g, ".")
    .toUpperCase();
}

function formatDateHeading(dateStr: string) {
  const today = jstToday();
  if (dateStr === today) return null; // null = show "ãããã®"
  const d = new Date(dateStr + "T00:00:00+09:00");
  return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric" }).format(d);
}

function PostPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const inputRefs = useRef<Partial<Record<CategoryKey, HTMLInputElement>>>({});

  // ?date=YYYY-MM-DD ãããã°ãã®æ¥ä»ããªããã°ä»æ¥
  const paramDate = searchParams.get("date");
  const targetDate = (paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)) ? paramDate : jstToday();
  const isPastEdit = targetDate !== jstToday();

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

  const filledCount = CATEGORIES.filter((c) => cells[c.key].previewUrl).length;

  useEffect(() => {
    async function loadPost() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: post } = await supabase
        .from("posts")
        .select("id, note")
        .eq("user_id", user.id)
        .eq("post_date", targetDate)
        .maybeSingle();

      if (!post) return;
      setIsEditMode(true);
      setNote(post.note ?? "");

      const { data: items } = await supabase
        .from("post_items")
        .select("category, image_url, caption")
        .eq("post_id", post.id);

      if (items) {
        const signedUrls: Record<string, string> = {};
        await Promise.all(
          items.map(async (item) => {
            if (item.image_url && !item.image_url.startsWith("http")) {
              const { data } = await supabase.storage
                .from("post-images")
                .createSignedUrl(item.image_url, 3600);
              if (data?.signedUrl) signedUrls[item.category] = data.signedUrl;
            } else {
              signedUrls[item.category] = item.image_url;
            }
          })
        );

        setCells((prev) => {
          const next = { ...prev };
          items.forEach((item) => {
            next[item.category as CategoryKey] = {
              previewUrl: signedUrls[item.category] ?? item.image_url,
              file: null,
              caption: item.caption ?? "",
            };
          });
          return next;
        });
      }
    }
    loadPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate]);

  async function handleFileChange(key: CategoryKey, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setCells((prev) => ({ ...prev, [key]: { file, previewUrl, caption: prev[key].caption } }));
  }

  function clearCell(key: CategoryKey) {
    setCells((prev) => ({ ...prev, [key]: emptyCell() }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ã­ã°ã¤ã³ãã¦ãã ãã");

      const { data: post, error: postErr } = await supabase
        .from("posts")
        .upsert(
          { user_id: user.id, post_date: targetDate, note: note.trim() },
          { onConflict: "user_id,post_date" }
        )
        .select("id")
        .single();
      if (postErr) throw postErr;

      const items: { post_id: string; category: string; image_url: string; caption: string }[] = [];

      for (const cat of CATEGORIES) {
        const cell = cells[cat.key];
        if (!cell.previewUrl) continue;

        let imageUrl = cell.previewUrl;
        if (cell.file) {
          const compressed = await imageCompression(cell.file, {
            maxSizeMB: 0.5,
            maxWidthOrHeight: 1080,
            useWebWorker: true,
          });
          const path = `${user.id}/${targetDate}/${cat.key}.jpg`;
          const { error: upErr } = await supabase.storage
            .from("post-images")
            .upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
          if (upErr) throw upErr;
          imageUrl = path;
        } else if (imageUrl.startsWith("http")) {
          // æ¢å­ã®signed URL â storage pathãåå©ç¨ããããDBããåå¾
          const { data: existing } = await supabase
            .from("post_items")
            .select("image_url")
            .eq("post_id", post!.id)
            .eq("category", cat.key)
            .maybeSingle();
          if (existing?.image_url && !existing.image_url.startsWith("http")) {
            imageUrl = existing.image_url;
          }
        }

        items.push({
          post_id: post!.id,
          category: cat.key,
          image_url: imageUrl,
          caption: cell.caption.trim(),
        });
      }

      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from("post_items")
          .upsert(items, { onConflict: "post_id,category" });
        if (itemsErr) throw itemsErr;
      }

      router.push(isPastEdit ? "/profile" : "/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "æç¨¿ã«å¤±æãã¾ãã");
    } finally {
      setSubmitting(false);
    }
  }

  const dateHeading = formatDateHeading(targetDate);
  const deliverLabel =
    filledCount === 0
      ? "ã¾ã ã:ãªã«ããã*ã¾ãã"
      : `${filledCount}æãå±ãã`;

  return (
    <div style={{ minHeight: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{
        flex: 1,
        padding: "84px 24px 8px",
        display: "flex",
        flexDirection: "column",
        gap: 36,
      }}>
        {/* masthead */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{
            fontFamily: "var(--font-instrument), sans-serif",
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.32em",
            color: "#A79D8C",
          }}>
            {formatDateLabel(targetDate)}
          </span>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <span style={{ fontSize: 40, fontWeight: 500, letterSpacing: "0.06em", lineHeight: 1.1 }}>
              {dateHeading ? (
                <>{dateHeading}ã®<br />4ã³ã</>
              ) : (
                <>ãããã®<br />4ã³ã</>
              )}
            </span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7, paddingBottom: 6 }}>
              <div style={{ display: "flex", gap: 5 }}>
                {CATEGORIES.map((c) => (
                  <span
                    key={c.key}
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 999,
                      background: cells[c.key].previewUrl ? "#2B2B28" : "#DDD3C0",
                      display: "inline-block",
                    }}
                  />
                ))}
              </div>
              <span style={{
                fontFamily: "var(--font-instrument), sans-serif",
                fontSize: 9,
                letterSpacing: "0.22em",
                color: "#C2B9A8",
              }}>
                {filledCount} / 4
              </span>
            </div>
          </div>

          <span style={{ fontSize: 11, fontWeight: 300, color: "#A79D8C", letterSpacing: "0.08em" }}>
            1<8Ã©æ-ã§ããå±ãããã¾ã
          </span>
        </div>

        {/* 2x2 ãã©ãã°ãªãã */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {CATEGORIES.map((cat) => {
            const cell = cells[cat.key];
            const gradient = CELL_GRADIENTS[cat.key] ?? "linear-gradient(160deg, #EAE2D2, #DDD3C0)";
            return (
              <div key={cat.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {cell.previewUrl ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      aspectRatio: "1",
                      position: "relative",
                      overflow: "hidden",
                      background: `${CELL_TEXTUPE}, ${gradient}`,
                      boxShadow: "inset 0 0 30px rgba(43,43,40,0.14)",
                    }}>
                      <img
                        src={cell.previewUrl}
                        alt={cat.label}
                        className="film-photo"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                      <span style={{
                        position: "absolute",
                        top: 10,
                        left: 10,
                        fontSize: 8,
                        letterSpacing: "0.28em",
                        color: "rgba(250,247,242,0.95)",
                        fontWeight: 500,
                        textShadow: "0 0 8px rgba(43,43,40,0.3)",
                      }}>
                        {cat.label}
                      </span>
                      <button
                        onClick={() => clearCell(cat.key)}
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          background: "rgba(43,43,40,0.5)",
                          border: "none",
                          borderRadius: "50%",
                          width: 22,
                          height: 22,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          color: "#FAF7F2",
                          fontSize: 10,
                        }}
                      >
                        Ã
                      </button>
                    </div>
                    <input
                      type="text"
                      value={cell.caption}
                      placeholder="ã²ã¨ãã¨"
                      onChange={(e) =>
                        setCells((prev) => ({
                          ...prev,
                          [cat.key]: { ...prev[cat.key], caption: e.target.value },
                        }))
                      }
                      maxLength={50}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        border: "none",
                        borderBottom: "1px solid #EAE2D2",
                        background: "transparent",
                        fontFamily: "var(--font-heading), sans-serif",
                        fontSize: 11,
                        fontWeight: 300,
                        letterSpacing: "0.06em",
                        color: "#2B2B28",
                        padding: "6px 1px",
                        outline: "none",
                      }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => inputRefs.current[cat.key]?.click()}
                    style={{
                      aspectRatio: "1",
                      border: "1px dashed #DDD2C0",
                      background: "transparent",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      cursor: "pointer",
                      width: "100%",
                    }}
                  >
                    <CameraIcon />
                    <span style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.3em", color: "#A79D8C" }}>
                      {cat.label}
                    </span>
                  </button>
                )}
                <input
                  ref={(el) => { if (el) inputRefs.current[cat.key] = el; }}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: "none" }}
                  onChange={(e) => handleFileChange(cat.key, e)}
                />
              </div>
            );
          })}
        </div>

        {/* 4ã³ãå®æã¡ãã»ã¼ã¸ */}
        {filledCount === 4 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: -12 }}>
            <span style={{ fontSize: 10, fontWeight: 400, letterSpacing: "0.3em", color: "#8A8375" }}>
              â ä»æ¥ã4cã³ããs£ãã¾ãã â
            </span>
          </div>
        )}

        {/* ãã¼ã */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ä»æ¥ã¨ããæ¥ããã²ã¨ãã¨ã§â¦"
          rows={2}
          maxLength={200}
          style={{
            width: "100%",
            boxSizing: "border-box",
            border: "none",
            borderBottom: "1px solid #EAE2D2",
            background: "transparent",
            fontFamily: "var(--font-heading), sans-serif",
            fontSize: 11,
            fontWeight: 300,
            lineHeight: 2,
            letterSpacing: "0.06em",
            color: "#2B2B28",
            padding: "6px 1px",
            outline: "none",
            resize: "none",
          }}
        />

        {error && (
          <p style={{ fontSize: 11, color: "#E8663C", letterSpacing: "0.06em" }}>{error}</p>
        )}

        {/* éä¿¡ãã¿ã³ */}
        <div style={{ marginTop: "auto", padding: "8px 0 14px", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting || filledCount === 0}
            style={{
              border: `1px solid ${filledCount === 0 ? "#DDD3C0" : "#E8663C"}`,
              color: filledCount === 0 ? "#C2B9A8" : "#E8663C",
              background: "transparent",
              borderRadius: 9999,
              padding: 15,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "0.22em",
              cursor: filledCount === 0 ? "not-allowed" : "pointer",
              width: "100%",
              fontFamily: "var(--font-heading), sans-serif",
            }}
          >
            {submitting
              ? "å±ãã¦ãã¾ãâ¦"
              : isEditMode
              ? `æ´æ°ãã (${filledCount}/4)`
              : deliverLabel}
          </button>
          <span style={{ fontSize: 9, fontWeight: 300, color: "#C2B9A8", textAlign: "center", letterSpacing: "0.14em" }}>
            ãã¨ããè¿½å ãã§ãã¾ã
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PostPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", minHeight: "50vh", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 11, color: "#A79D8C", letterSpacing: "0.14em" }}>èª­ã¿è¾¼ã¿ä¸­â¦</span>
      </div>
    }>
      <PostPageInner />
    </Suspense>
  );
}
