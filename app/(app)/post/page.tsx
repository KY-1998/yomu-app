// 投稿画面 - 当日投稿編集対応
"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import imageCompression from "browser-image-compression";
import { CATEGORIES, jstToday, type CategoryKey } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const CELL_GRADIENTS = {
  face: "linear-gradient(160deg, #D9BFB0, #C9A28F)",
  scene: "linear-gradient(160deg, #A8B5A0, #96A48D)",
  weather: "linear-gradient(160deg, #AEBFC9, #9DB0BD)",
  food: "linear-gradient(160deg, #D6B98C, #C7A76F)",
};
const CELL_TEXTURE = "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 7px, rgba(43,43,40,0.03) 7px 14px)";

function CameraIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="3.5" width="6" height="3.5" rx="1.2" stroke="#CDC4B2" strokeWidth="1.2"/>
      <rect x="3" y="6.5" width="18" height="13.5" rx="2.5" stroke="#CDC4B2" strokeWidth="1.2"/>
      <circle cx="12" cy="13" r="3.5" stroke="#CDC4B2" strokeWidth="1.2"/>
    </svg>
  );
}

const emptyCell = () => ({ file: null, previewUrl: null, caption: "" });

function formatDateLabel() {
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", weekday: "short", timeZone: "Asia/Tokyo" }).format(new Date()).toUpperCase();
}

export default function PostPage() {
  const router = useRouter();
  const supabase = createClient();
  const inputRefs = useRef({});
  const [cells, setCells] = useState({ face: emptyCell(), scene: emptyCell(), weather: emptyCell(), food: emptyCell() });
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const filledCount = CATEGORIES.filter((c) => cells[c.key].previewUrl).length;

  useEffect(() => {
    async function loadTodayPost() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = jstToday();
      const { data: post } = await supabase.from("posts").select("id, note").eq("user_id", user.id).eq("post_date", today).maybeSingle();
      if (!post) return;
      setIsEditMode(true);
      setNote(post.note ?? "");
      const { data: items } = await supabase.from("post_items").select("category, image_url, caption").eq("post_id", post.id);
      if (items) {
        setCells((prev) => {
          const next = { ...prev };
          items.forEach((item) => { next[item.category] = { previewUrl: item.image_url, file: null, caption: item.caption ?? "" }; });
          return next;
        });
      }
    }
    loadTodayPost();
  }, []);

  async function handleFileChange(key, e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCells((prev) => ({ ...prev, [key]: { file, previewUrl: URL.createObjectURL(file), caption: prev[key].caption } }));
  }

  function clearCell(key) {
    setCells((prev) => ({ ...prev, [key]: emptyCell() }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("ログインしてください");
      const today = jstToday();
      const { data: post, error: postErr } = await supabase.from("posts").upsert({ user_id: user.id, post_date: today, note: note.trim() }, { onConflict: "user_id,post_date" }).select("id").single();
      if (postErr) throw postErr;
      const items = [];
      for (const cat of CATEGORIES) {
        const cell = cells[cat.key];
        if (!cell.previewUrl) continue;
        let imageUrl = cell.previewUrl;
        if (cell.file) {
          const compressed = await imageCompression(cell.file, { maxSizeMB: 0.5, maxWidthOrHeight: 1080, useWebWorker: true });
          const path = `${user.id}/${today}/${cat.key}.jpg`;
          const { error: upErr } = await supabase.storage.from("post-images").upload(path, compressed, { upsert: true, contentType: "image/jpeg" });
          if (upErr) throw upErr;
          imageUrl = path;
        }
        items.push({ post_id: post.id, category: cat.key, image_url: imageUrl, caption: cell.caption.trim() });
      }
      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from("post_items").upsert(items, { onConflict: "post_id,category" });
        if (itemsErr) throw itemsErr;
      }
      router.push("/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  const deliverLabel = filledCount === 0 ? "まだ、なにもありません" : `${filledCount}枚を届ける`;

  return (
    <div style={{ minHeight:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ flex:1, padding:"84px 24px 8px", display:"flex", flexDirection:"column", gap:36 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          <span style={{ fontFamily:"var(--font-instrument), sans-serif", fontSize:10, fontWeight:500, letterSpacing:"0.32em", color:"#A79D8C" }}>{formatDateLabel()}</span>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
            <span style={{ fontSize:40, fontWeight:500, letterSpacing:"0.06em", lineHeight:1.1 }}>きょうの<br/>4コマ</span>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:7, paddingBottom:6 }}>
              <div style={{ display:"flex", gap:5 }}>
                {CATEGORIES.map((c) => <span key={c.key} style={{ width:4, height:4, borderRadius:999, background:cells[c.key].previewUrl?"#2B2B28":"#DDD3C0", display:"inline-block" }}/>)}
              </div>
              <span style={{ fontFamily:"var(--font-instrument), sans-serif", fontSize:9, letterSpacing:"0.22em", color:"#C2B9A8" }}>{filledCount} / 4</span>
            </div>
          </div>
          <span style={{ fontSize:11, fontWeight:300, color:"#A79D8C", letterSpacing:"0.08em" }}>1枚だけでも、届けられます</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {CATEGORIES.map((cat) => {
            const cell = cells[cat.key];
            const gradient = CELL_GRADIENTS[cat.key] ?? "linear-gradient(160deg, #EAE2D2, #DDD3C0)";
            return (
              <div key={cat.key} style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {cell.previewUrl ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ aspectRatio:"1", position:"relative", overflow:"hidden", background:`${CELL_TEXTURE}, ${gradient}`, boxShadow:"inset 0 0 30px rgba(43,43,40,0.14)" }}>
                      <img src={cell.previewUrl} alt={cat.label} className="film-photo" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                      <span style={{ position:"absolute", top:10, left:10, fontSize:8, letterSpacing:"0.28em", color:"rgba(250,247,242,0.95)", fontWeight:500, textShadow:"0 0 8px rgba(43,43,40,0.3)" }}>{cat.label}</span>
                      <button onClick={() => clearCell(cat.key)} style={{ position:"absolute", top:6, right:6, background:"rgba(43,43,40,0.5)", border:"none", borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#FAF7F2", fontSize:10 }}>×</button>
                    </div>
                    <input type="text" value={cell.caption} placeholder="ひとこと" onChange={(e) => setCells((prev) => ({ ...prev, [cat.key]: { ...prev[cat.key], caption: e.target.value } }))} maxLength={50} style={{ width:"100%", boxSizing:"border-box", border:"none", borderBottom:"1px solid #EAE2D2", background:"transparent", fontFamily:"var(--font-heading), sans-serif", fontSize:11, fontWeight:300, letterSpacing:"0.06em", color:"#2B2B28", padding:"6px 1px", outline:"none" }}/>
                  </div>
                ) : (
                  <button onClick={() => inputRefs.current[cat.key]?.click()} style={{ aspectRatio:"1", border:"1px dashed #DDD3C0", background:"transparent", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, cursor:"pointer", width:"100%" }}>
                    <CameraIcon/>
                    <span style={{ fontSize:11, fontWeight:400, letterSpacing:"0.3em", color:"#A79D8C" }}>{cat.label}</span>
                  </button>
                )}
                <input ref={(el) => { if (el) inputRefs.current[cat.key] = el; }} type="file" accept="image/*" capture="environment" style={{ display:"none" }} onChange={(e) => handleFileChange(cat.key, e)}/>
              </div>
            );
          })}
        </div>

        {filledCount === 4 && (
          <div style={{ display:"flex", justifyContent:"center", marginTop:-12 }}>
            <span style={{ fontSize:10, fontWeight:400, letterSpacing:"0.3em", color:"#8A8375" }}>— 今日の4コマ、そろいました —</span>
          </div>
        )}

        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="今日という日を、ひとことで…" rows={2} maxLength={200} style={{ width:"100%", boxSizing:"border-box", border:"none", borderBottom:"1px solid #EAE2D2", background:"transparent", fontFamily:"var(--font-heading), sans-serif", fontSize:11, fontWeight:300, lineHeight:2, letterSpacing:"0.06em", color:"#2B2B28", padding:"6px 1px", outline:"none", resize:"none" }}/>

        {error && <p style={{ fontSize:11, color:"#E8663C", letterSpacing:"0.06em" }}>{error}</p>}

        <div style={{ marginTop:"auto", padding:"8px 0 14px", display:"flex", flexDirection:"column", gap:10 }}>
          <button onClick={handleSubmit} disabled={submitting || filledCount === 0} style={{ border:`1px solid ${filledCount===0?"#DDD3C0":"#E8663C"}`, color:filledCount===0?"#C2B9A8":"#E8663C", background:"transparent", borderRadius:9999, padding:15, textAlign:"center", fontSize:13, fontWeight:500, letterSpacing:"0.22em", cursor:filledCount===0?"not-allowed":"pointer", width:"100%", fontFamily:"var(--font-heading), sans-serif" }}>
            {submitting ? "届けています…" : isEditMode ? `更新する (${filledCount}/4)` : deliverLabel}
          </button>
          <span style={{ fontSize:9, fontWeight:300, color:"#C2B9A8", textAlign:"center", letterSpacing:"0.14em" }}>あとから追加もできます</span>
        </div>
      </div>
    </div>
  );
}
