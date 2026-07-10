import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CATEGORIES = [
  { key: "face", label: "顔", emoji: "🙂", hint: "今日のあなた" },
  { key: "scene", label: "景色", emoji: "🏞", hint: "目に映ったもの" },
  { key: "weather", label: "天気", emoji: "☁️", hint: "今日の空" },
  { key: "food", label: "ご飯", emoji: "🍚", hint: "食べたもの" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export function jstToday(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());
}
