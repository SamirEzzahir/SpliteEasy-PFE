import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth/AuthContext";
import ConditionalShell from "@/components/shell/ConditionalShell";

export const metadata: Metadata = {
  title: "SplitEasy — Econome",
  description: "Split bills, track jars, manage your money with the 6-jar system.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <AuthProvider>
          <AppProvider>
            <ConditionalShell>{children}</ConditionalShell>
          </AppProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
