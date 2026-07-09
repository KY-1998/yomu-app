import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supabase Storage の画像を next/image で表示するための設定
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
};

export default nextConfig;
