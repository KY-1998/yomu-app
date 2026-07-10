// アプリ全体で使う型定義（DBスキーマに対応）
import type { CategoryKey } from "./utils";

export type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string;
};

export type PostItem = {
  id: string;
  category: CategoryKey;
  image_url: string;
  caption: string;
};

export type Post = {
  id: string;
  user_id: string;
  post_date: string;
  note: string;
  items: PostItem[];
  profile?: Profile;
};
