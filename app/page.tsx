import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 p-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-latin text-4xl font-bold tracking-tight">yomu</h1>
        <p className="text-center text-sm text-muted">
          毎日4枚の写真を交換する、
          <br />
          友達とだけのSNS
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button size="lg" className="w-full" asChild>
          <Link href="/login">ログイン</Link>
        </Button>
        <Button size="lg" variant="outline" className="w-full" asChild>
          <Link href="/register">新規登録</Link>
        </Button>
      </div>
    </div>
  );
}
