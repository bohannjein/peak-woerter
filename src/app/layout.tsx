import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";

const archivo = localFont({
  src: "../fonts/archivo.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});
const charis = localFont({
  src: [
    { path: "../fonts/charis.woff2", style: "normal", weight: "400" },
    { path: "../fonts/charis-italic.woff2", style: "italic", weight: "400" },
  ],
  variable: "--font-charis",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Peake Wörter", template: "%s · Peake Wörter" },
  description: "Unser kleines Archiv für bemerkenswerte Begriffe.",
  applicationName: "Peake Wörter",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Peake", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false }, // internal archive
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e4e7ee" },
    { media: "(prefers-color-scheme: dark)", color: "#10121a" },
  ],
};

// Applies stored theme/motion preferences before first paint.
const prefs = `try{var d=document.documentElement,t=localStorage.getItem("theme"),m=localStorage.getItem("motion");if(t)d.dataset.theme=t;if(m)d.dataset.motion=m}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="de" className={`${archivo.variable} ${charis.variable}`} suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: prefs }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
