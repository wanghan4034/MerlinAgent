import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import { Providers } from "./providers";

export const metadata: Metadata = { title: "Mercari 控制台 Pro" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
