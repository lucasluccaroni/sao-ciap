import type { Metadata } from "next";
import { Livvic, Creepster } from "next/font/google";
import "./globals.css";

const livvic = Livvic({
  variable: "--font-livvic",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const creepster = Creepster({
  variable: "--font-creepster",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "SAO Bar - Sistema de Gestión",
  description: "Sistema de gestión y comandas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${livvic.variable} ${creepster.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-livvic bg-bg-base text-text-main">
        {children}
      </body>
    </html>
  );
}
