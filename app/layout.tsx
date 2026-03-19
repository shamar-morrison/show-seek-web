import { Footer } from "@/components/footer"
import { Navbar } from "@/components/navbar"
import { Providers } from "@/components/providers"
import { Analytics } from "@vercel/analytics/next"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#E50914",
}

export const metadata: Metadata = {
  title: "ShowSeek",
  description: "Discover, Track, and Share your favorite movies and TV shows",
  metadataBase: new URL("https://showseek.com"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ShowSeek",
  },
  openGraph: {
    title: "ShowSeek",
    description: "Discover, Track, and Share your favorite movies and TV shows",
    url: "https://showseek.com",
    siteName: "ShowSeek",
    images: [
      {
        url: "/showseek_og.png",
        width: 1200,
        height: 630,
        alt: "ShowSeek - Discover, Track, Share Movies & TV Shows",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShowSeek",
    description: "Discover, Track, and Share your favorite movies and TV shows",
    images: ["/showseek_og.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased font-sans`}>
        <Providers>
          <Navbar />
          {children}
          <Analytics />
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
