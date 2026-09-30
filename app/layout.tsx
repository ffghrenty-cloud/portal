import Assistant from "./components/Assistant";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ОршаЛён — оптовый портал",
  description:
    "Веб-портал для оптовых заказчиков РУПТП «Оршанский льнокомбинат»",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={inter.variable} data-scroll-behavior="smooth">
      <body>
        <Header />
        <main>{children}</main>
        <Assistant />
      </body>
    </html>
  );
}