"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { CATEGORIES, jstToday, type CategoryKey } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const CELL_GRADIENTS: Record<CategoryKey, string> = {
  face: "linear-gradient(160deg, #D9BFB0, #C9A28F)",
  scene: "linear-gradient(160deg, #A8B5A0, #96A48D)",
  weather: "linear-gradient(160deg, #AEBFC9, #9DB0BD)",
  food: "linear-gradient(160deg, #D6B98C, #C7A76F)",
};
const CELL_TEXTURE = "repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 7px, rgba(43,43,40,0.03) 7px 14px)";
const PRESET_EMOJIS = ["❤️", "😊", "😍", "😆", "👍", "🥹", "✨", "🫂"];

type Reaction = { emoji: string; user_id: string };

function aggregateReactions(raw: Reaction[], myId: string | null) {
  const map: Record<string, { count: number; mine: boolean }> = {};
  raw.forEach((r) => {
    if (!map[r.emoji]) map[r.emoji] = { count: 0, mine: false };
    map[r.emoji].count++;
    if (r.user_id === myId) map[r.emoji].mine = true;
  });
  return Object.entries(map).map(([emoji, v]) => ({ emoji, ...v }));
}

function formatJST(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" });
}

function formatDateLabel() {
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", weekday: "short", timeZone: "Asia/Tokyo" }).format(new Date()).toUpperCase();
}

export default function HomePage() {
  const supabase = createClient();
  const [posts, setPosts] = useState<any[]>([]);
  const [hasPostedToday, setHasPostedToday] = useState(false);
  const [friendsPostedCount, setFriendsPostedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [pickerPostId, setPickerPostId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: myPost } = await supabase.from("posts").select("id").eq("user_id", user.id).eq("post_date", jstToday()).maybeSingle();
      const posted = !!myPost;
      setHasPostedToday(posted);

      if (posted) {
        const { data } = await supabase
          .from("posts")
          .select(`id, note, created_at, profiles!posts_user_id_fkey ( username, display_name ), post_items ( category, image_url ), reactions ( emoji, user_id )`)
          .eq("post_date", jstToday())
          .neq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (data) {
          const withUrls = await Promise.all(data.map(async (post) => {
            const imageUrls: Record<string, string> = {};
            await Promise.all(post.post_items.map(async (item: any) => {
              const { data: urlData } = await supabase.storage.from("post-images").createSignedUrl(item.image_url, 3600);
              if (urlData?.signedUrl) imageUrls[item.category] = urlData.signedUrl;
            }));
            return { ...post, post_items: post.post_items.map((item: any) => ({ ...item, signedUrl: imageUrls[item.category] })) };
          }));
          setPosts(withUrls);
        }
      } else {
        const { data: count } = await supabase.rpc("count_friends_posts_today");
        setFriendsPostedCount(count ?? 0);
      }

      setLoading(false);
    }
    load();
  }, []);

  // ピッカー外クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerPostId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function toggleReaction(postId: string, emoji: string) {
    if (!userId) return;

    const post = posts.find(p => p.id === postId);
    const myReaction = post?.reactions.find((r: Reaction) => r.emoji === emoji && r.user_id === userId);

    if (myReaction) {
      // 楽観的削除
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, reactions: p.reactions.filter((r: Reaction) => !(r.emoji === emoji && r.user_id === userId)) }
          : p
      ));
      await supabase.from("reactions").delete()
        .eq("post_id", postId).eq("user_id", userId).eq("emoji", emoji);
    } else {
      // 楽観的追加
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? { ...p, reactions: [...p.reactions, { emoji, user_id: userId }] }
          : p
      ));
      await supabase.from("reactions").insert({ post_id: postId, user_id: userId, emoji });
    }
    setPickerPostId(null);
  }

  if (loading) return (
    <div style={{ display:"flex", minHeight:"50vh", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontSize:11, color:"#A79D8C", letterSpacing:"0.14em" }}>読み込み中…</span>
    </div>
  );

  return (
    <div style={{ minHeight:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"84px 24px 40px", display:"flex", flexDirection:"column", gap:10 }}>
        <span style={{ fontFamily:"var(--font-instrument), sans-serif", fontSize:10, fontWeight:500, letterSpacing:"0.32em", color:"#A79D8C" }}>
          {formatDateLabel()}
        </span>
        <span style={{ fontSize:40, fontWeight:500, letterSpacing:"0.06em", lineHeight:1.1 }}>きょう</span>
        <span style={{ fontSize:11, fontWeight:300, color:"#A79D8C", letterSpacing:"0.08em" }}>
          {posts.length > 0
            ? `${posts.length}人が4コマを届けました`
            : hasPostedToday
            ? "友達はまだ投稿していません"
            : friendsPostedCount > 0
            ? `${friendsPostedCount}人が4コマを届けました`
            : "投稿すると友達の今日が見えます"}
        </span>
      </div>

      {!hasPostedToday && (
        <div style={{ padding:"0 24px 32px" }}>
          <Link href="/post" style={{ display:"inline-block", border:"1px solid rgba(43,43,40,0.2)", background:"transparent", borderRadius:9999, padding:"10px 24px", fontSize:12, letterSpacing:"0.08em", color:"#2B2B28", textDecoration:"none" }}>
            今日を届ける →
          </Link>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column" }}>
        {posts.map((post) => {
          const author = post.profiles;
          const reactions = aggregateReactions(post.reactions, userId);
          const itemsByCategory = Object.fromEntries(post.post_items.map((i: any) => [i.category, i]));
          const isPickerOpen = pickerPostId === post.id;

          return (
            <div key={post.id} style={{ paddingBottom:56 }}>
              <div style={{ display:"flex", alignItems:"baseline", padding:"0 24px", gap:10, marginBottom:12 }}>
                <span style={{ fontSize:11, fontWeight:500, letterSpacing:"0.14em", color:"#8A8375" }}>{author?.display_name || author?.username}</span>
                <span style={{ fontFamily:"var(--font-instrument), sans-serif", fontSize:10, fontWeight:400, letterSpacing:"0.18em", color:"#C2B9A8" }}>{formatJST(post.created_at)}</span>
                <div style={{ marginLeft:"auto", display:"flex", gap:5, alignItems:"center" }}>
                  {CATEGORIES.map((c) => <span key={c.key} style={{ width:4, height:4, borderRadius:999, background:itemsByCategory[c.key]?"#2B2B28":"#DDD3C0", display:"inline-block" }}/>)}
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2 }}>
                {CATEGORIES.map((c) => {
                  const item = itemsByCategory[c.key];
                  const gradient = CELL_GRADIENTS[c.key];
                  return (
                    <div key={c.key} style={{ aspectRatio:"1", position:"relative", overflow:"hidden", background:item?`${CELL_TEXTURE}, ${gradient}`:"#EAE2D2", boxShadow:item?"inset 0 0 30px rgba(43,43,40,0.14)":"none" }}>
                      {item?.signedUrl ? <img src={item.signedUrl} alt={c.label} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : null}
                      {item && <span style={{ position:"absolute", top:10, left:10, fontSize:8, letterSpacing:"0.28em", color:"rgba(250,247,242,0.95)", fontWeight:500, textShadow:"0 0 8px rgba(43,43,40,0.3)" }}>{c.label}</span>}
                    </div>
                  );
                })}
              </div>

              {post.note && (
                <div style={{ padding:"14px 24px 0" }}>
                  <p style={{ margin:0, fontSize:11, fontWeight:300, lineHeight:2, color:"#6E675C", letterSpacing:"0.04em" }}>{post.note}</p>
                </div>
              )}

              {/* リアクションエリア */}
              <div style={{ padding:"12px 24px 0", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", position:"relative" }}>
                {reactions.map((r) => (
                  <button
                    key={r.emoji}
                    onClick={() => toggleReaction(post.id, r.emoji)}
                    style={{
                      display:"flex", alignItems:"center", gap:4,
                      background: r.mine ? "rgba(232,102,60,0.08)" : "rgba(43,43,40,0.04)",
                      border: r.mine ? "1px solid rgba(232,102,60,0.3)" : "1px solid rgba(43,43,40,0.1)",
                      borderRadius:999, padding:"4px 10px",
                      cursor:"pointer", transition:"all 0.15s",
                    }}
                  >
                    <span style={{ fontSize:14 }}>{r.emoji}</span>
                    <span style={{ fontFamily:"var(--font-instrument), sans-serif", fontSize:11, color: r.mine ? "#E8663C" : "#C2B9A8" }}>{r.count}</span>
                  </button>
                ))}

                {/* ＋ボタン */}
                <div style={{ position:"relative" }}>
                  <button
                    onClick={() => setPickerPostId(isPickerOpen ? null : post.id)}
                    style={{ fontSize:13, color:"#C2B9A8", background:"rgba(43,43,40,0.04)", border:"1px solid rgba(43,43,40,0.1)", borderRadius:999, padding:"4px 10px", cursor:"pointer" }}
                  >
                    ＋
                  </button>

                  {isPickerOpen && (
                    <div ref={pickerRef} style={{ position:"absolute", bottom:"calc(100% + 8px)", left:0, background:"#FDFAF5", border:"1px solid rgba(43,43,40,0.1)", borderRadius:16, padding:"10px 12px", display:"flex", gap:6, flexWrap:"wrap", boxShadow:"0 4px 20px rgba(43,43,40,0.12)", zIndex:20, minWidth:180 }}>
                      {PRESET_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(post.id, emoji)}
                          style={{ fontSize:22, background:"none", border:"none", cursor:"pointer", padding:"2px 4px", borderRadius:8, transition:"transform 0.1s" }}
                          onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.2)")}
                          onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* 未投稿 + 友達が投稿済み */}
        {!hasPostedToday && friendsPostedCount > 0 && Array.from({ length: friendsPostedCount }).map((_, i) => (
          <div key={`placeholder-${i}`} style={{ paddingBottom:56 }}>
            <div style={{ display:"flex", alignItems:"baseline", padding:"0 24px", gap:10, marginBottom:12 }}>
              <span style={{ fontSize:11, fontWeight:500, letterSpacing:"0.14em", color:"#C2B9A8" }}>— — —</span>
            </div>
            <div style={{ position:"relative" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:2, filter:"blur(18px) saturate(0.6)", transform:"scale(1.06)", overflow:"hidden" }}>
                {CATEGORIES.map((c) => (
                  <div key={c.key} style={{ aspectRatio:"1", background:`${CELL_TEXTURE}, ${CELL_GRADIENTS[c.key]}`, boxShadow:"inset 0 0 30px rgba(43,43,40,0.14)" }} />
                ))}
              </div>
              <div style={{ position:"absolute", inset:0, zIndex:5, backdropFilter:"blur(18px) saturate(1.05)", WebkitBackdropFilter:"blur(18px) saturate(1.05)", background:"rgba(250,247,242,0.45)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:22, textAlign:"center", padding:24 }}>
                <span style={{ fontSize:12, fontWeight:400, color:"#6E675C", lineHeight:2.1, letterSpacing:"0.12em" }}>今日の4コマを投稿すると<br/>見れます</span>
                <Link href="/post" style={{ border:"1px solid #E8663C", color:"#E8663C", background:"transparent", borderRadius:9999, padding:"13px 30px", fontSize:12, fontWeight:500, letterSpacing:"0.18em", textDecoration:"none" }}>4コマを撮りにいく</Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {posts.length > 0 && <p style={{ textAlign:"center", fontSize:11, letterSpacing:"0.3em", color:"#A79D8C", padding:"16px 0 8px" }}>— きょうはここまで —</p>}
    </div>
  );
}
