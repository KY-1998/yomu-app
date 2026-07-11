// OAuth / Magic Link コールバック処理
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/home";

  if (code) {
        const cookieStore = await cookies();
        const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
                    cookies: {
                                getAll() {
                                              return cookieStore.getAll();
                                },
                                setAll(cookiesToSet) {
                                              cookiesToSet.forEach(({ name, value, options }) =>
                                                              cookieStore.set(name, value, options)
                                                                               );
                                },
                    },
          }
              );
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                          // プロフィールが未設定の場合はセットアップ画面へ
                  const { data: profile } = await supabase
                            .from("profiles")
                            .select("display_name")
                            .eq("id", user.id)
                            .maybeSingle();

                  if (!profile?.display_name) {
                              const setupParam = next !== "/home" ? `?next=${encodeURIComponent(next)}` : "";
                              return NextResponse.redirect(`${origin}/setup${setupParam}`);
                  }
                }
                return NextResponse.redirect(`${origin}${next}`);
        }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
