import type { Metadata } from "next";
import "./globals.css";
import Header from "./components/Header";

export const metadata: Metadata = {
  title: "Оршанский льнокомбинат — оптовый портал",
  description: "Оптовые заказы продукции Оршанского льнокомбината",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="bg-gray-50 min-h-screen">
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}