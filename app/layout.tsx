import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APS Market Intelligence",
  description:
    "Интерактивная сравнительная аналитика восьми рынков для APS.",
  openGraph: {
    title: "APS Market Intelligence",
    description: "Проверенная сравнительная аналитика восьми рынков APS.",
    type: "website",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
