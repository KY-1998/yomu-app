"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const p = usePathname();
  const isHome = p === "/home" || p === "/";
  const isPost = p === "/post";
  const isProfile = p === "/profile";

  const col = (active: boolean) => active ? "#2B2B28" : "#B4AA98";
  const fw = (active: boolean): number => active ? 500 : 400;
  const sw = (active: boolean) => active ? "1.4" : "1.2";

  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 448,
        zIndex: 20,
        background: "rgba(250,247,242,0.55)",
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        borderTop: "1px solid rgba(43,43,40,0.06)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        padding: "12px 0 32px",
      }}
    >
      <Link href="/home" style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5,color:col(isHome),textDecoration:"none" }}>
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
          <rect x="1.5" y="1.5" width="7" height="7" rx="1" fill={isHome?"#2B2B28":"none"} stroke={isHome?"none":"#B4AA98"} strokeWidth="1.2"/>
          <rect x="11.5" y="1.5" width="7" height="7" rx="1" fill={isHome?"#2B2B28":"none"} stroke={isHome?"none":"#B4AA98"} strokeWidth="1.2"/>
          <rect x="1.5" y="11.5" width="7" height="7" rx="1" fill={isHome?"#2B2B28":"none"} stroke={isHome?"none":"#B4AA98"} strokeWidth="1.2"/>
          <rect x="11.5" y="11.5" width="7" height="7" rx="1" fill={isHome?"#2B2B28":"none"} stroke={isHome?"none":"#B4AA98"} strokeWidth="1.2"/>
        </svg>
        <span style={{ fontSize:8,fontWeight:fw(isHome),letterSpacing:"0.24em" }}>きょう</span>
      </Link>
      <Link href="/post" style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5,color:col(isPost),textDecoration:"none" }}>
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke={col(isPost)} strokeWidth={sw(isPost)}/>
          <path d="M10 6.5v7M6.5 10h7" stroke={col(isPost)} strokeWidth={sw(isPost)} strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize:8,fontWeight:fw(isPost),letterSpacing:"0.24em" }}>とうこう</span>
      </Link>
      <Link href="/profile" style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:5,color:col(isProfile),textDecoration:"none" }}>
        <svg width="19" height="19" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="7.5" r="3" stroke={col(isProfile)} strokeWidth="1.2"/>
          <path d="M3.5 17.5c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" stroke={col(isProfile)} strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span style={{ fontSize:8,fontWeight:fw(isProfile),letterSpacing:"0.24em" }}>じぶん</span>
      </Link>
    </nav>
  );
}
