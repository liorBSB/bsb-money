import "./globals.css";
import { MonthProvider } from "@/lib/monthContext";
import { Heebo, Poppins } from "next/font/google";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata = {
  title: "BSB Money",
  description: "מערכת ניהול תשלומים וקבלות",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#076332",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className={`${heebo.variable} ${poppins.variable} min-h-screen antialiased`}>
        <MonthProvider>
          {children}
        </MonthProvider>
      </body>
    </html>
  );
}
