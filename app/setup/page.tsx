"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function SetupPageInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/home";

  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const googleName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.email?.split("@")[0] ||
        "";
      setDisplayName(googleName);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        display_name: displayName.trim(),
        username: "user_" + user.id.replace(/-/g, "").substring(0, 12),
        bio: "",
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

      if (upsertError) {
        setSaving(false);
        return;
      }

      // middlewareが参照するuser_metadataにprofile_completeフラグを設定
      await supabase.auth.updateUser({ data: { profile_complete: true } });

      router.push(next);
    } catch {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-latin text-4xl font-bold tracking-tight">yomu</h1>
        <p className="text-sm text-muted">プロフィールを設定しましょう</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-6">
        <div className="flex justify-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-accent/20">
            <span className="text-3xl font-medium text-accent">
              {displayName?.[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs tracking-wide text-muted">表示名</label>
          <input
            type="text"
            placeholder="あなたの名前"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            autoFocus
            className="rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={handleSave}
          disabled={saving || !displayName.trim()}
        >
          {saving ? "保存中..." : "はじめる →"}
        </Button>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
          読み込み中...
        </div>
      }
    >
      <SetupPageInner />
    </Suspense>
  );
}
