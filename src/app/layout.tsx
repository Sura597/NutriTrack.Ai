import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { Toaster } from "sonner";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME || "NutriTrack AI";

export const metadata: Metadata = {
  title: { default: appName, template: `%s · ${appName}` },
  description: "Know what you eat, understand what your body needs, and discover affordable ways to eat better.",
  applicationName: appName,
};

export const viewport: Viewport = { themeColor: "#1f7a4d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={GeistSans.variable}>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
