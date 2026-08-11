import type { Metadata, Viewport } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { DEFAULT_THEME_ID, THEME_STORAGE_KEY } from "@/lib/theme/themes";

const showThemeSwitcher = process.env.NODE_ENV !== "production";

// Applied before hydration so a stored theme choice doesn't flash the default on load.
const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t&&t!==${JSON.stringify(DEFAULT_THEME_ID)})document.documentElement.setAttribute("data-theme",t);}catch(e){}`;

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Munch",
  description: "Swipe to pick where the group eats.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Munch",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f6f3ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${roboto.variable} h-full antialiased`} suppressHydrationWarning={showThemeSwitcher}>
      <body className="min-h-full flex flex-col font-sans">
        {showThemeSwitcher && <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />}
        {showThemeSwitcher && <ThemeSwitcher />}
        {children}
      </body>
    </html>
  );
}
