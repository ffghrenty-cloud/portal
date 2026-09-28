import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Оршанский льнокомбинат — оптовый портал",
  description: "Оптовые заказы льняной продукции",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={`${inter.className} bg-white text-black min-h-screen`}>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}