"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ProfileEditPage() {
  const supabase = createClient();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const { data: prof } = await supabase
        .from("profiles")
        .select("display_name, bio")
        .eq("id", user.id)
        .maybeSingle();
      if (prof) {
        setDisplayName(prof.display_name ?? "");
        setBio(prof.bio ?? "");
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), bio: bio.trim(), updated_at: new Date().toISOString() })
      .eq("id", user.id);
    setSaved(true);
    setSaving(false);
    setTimeout(() => router.push("/profile"), 1000);
  }

  if (loading) return (
    <div className="flex h-60 items-center justify-center">
      <span className="text-sm text-muted-foreground">読み込み中...</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 p-6 pt-20">
      <h1 className="text-xl font-semibold">プロフィールを編集</h1>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">表示名</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={30}
            className="w-full rounded-xl border border-border bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="名前を入力"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">ひとこと</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={100}
            rows={3}
            className="w-full rounded-xl border border-border bg-transparent px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            placeholder="自己紹介（任意）"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || saved}
        className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saved ? "保存しました！" : saving ? "保存中..." : "保存する"}
      </button>

      <button
        onClick={() => router.push("/profile")}
        className="text-center text-sm text-muted-foreground"
      >
        キャンセル
      </button>
    </div>
  );
}
