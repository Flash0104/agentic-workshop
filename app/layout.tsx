import { Toaster } from "@/components/ui/toaster";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Agentic Workshop Trainer",
  description: "AI-powered interview and sales training platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body className={`${inter.className} bg-[#0b0b10] text-slate-100 antialiased selection:bg-blue-600 selection:text-white`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
