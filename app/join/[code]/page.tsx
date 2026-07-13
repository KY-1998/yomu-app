"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function JoinPage() {
    const { code } = useParams<{ code: string }>();
    const supabase = createClient();
    const router = useRouter();

  useEffect(() => {
        (async () => {
                const {
                          data: { user },
                } = await supabase.auth.getUser();

               if (!user) {
                         sessionStorage.setItem("yomu_invite_code", code);
                         router.replace("/");
                         return;
               }

               await supabase.rpc("redeem_invite", { invite_code: code });
                sessionStorage.removeItem("yomu_invite_code");
                router.replace("/home");
        })();
  }, [code]);

  return (
        <div className="flex min-h-dvh items-center justify-center">
              <p className="text-sm text-muted">読み込み中...</p>p>
        </div>div>
      );
}</div>
