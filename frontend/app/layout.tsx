import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "react-toastify/dist/ReactToastify.css";
import { ToastContainer } from "react-toastify";
import { AppProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { WSProvider } from "@/lib/ws-context";
import { PublicSettingsProvider } from "@/lib/public-settings";
import ConditionalShell from "@/components/shell/ConditionalShell";

export const metadata: Metadata = {
  title: "SplitEasy",
  applicationName: "SplitEasy",
  description: "Split bills, track shared spending, settle balances, and organize your money in one simple place.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/branding/app-icon.png", sizes: "1254x1254", type: "image/png" }],
    apple: [{ url: "/branding/app-icon.png", sizes: "1254x1254", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "SplitEasy", statusBarStyle: "default" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <AuthProvider>
          <WSProvider>
            <PublicSettingsProvider>
              <AppProvider>
                <ConditionalShell>{children}</ConditionalShell>
              </AppProvider>
            </PublicSettingsProvider>
          </WSProvider>
        </AuthProvider>
        <ToastContainer position="bottom-right" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick pauseOnHover theme="colored" />
      </body>
    </html>
  );
}
