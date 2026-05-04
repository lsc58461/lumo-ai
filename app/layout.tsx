import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Sans_KR } from "next/font/google";
import "streamdown/styles.css";

import "./globals.css";

const bodyFont = Noto_Sans_KR({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const displayFont = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "루모 AI | 운명을 비추는 AI 사주",
  description:
    "카카오로 시작해서 연애, 진로, 궁합, 오늘의 흐름을 대화형으로 물어보는 루모 AI 사주 서비스입니다.",
  applicationName: "루모 AI",
  openGraph: {
    title: "루모 AI",
    description: "연애, 진로, 궁합, 오늘의 흐름을 대화형으로 묻는 AI 사주 서비스.",
    siteName: "루모 AI",
    locale: "ko_KR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${bodyFont.variable} ${displayFont.variable} dark h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">{children}</body>
    </html>
  );
}
