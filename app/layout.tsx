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
  title: "ShowSeek | Track Your Movies and Shows",
  description:
    "Discover, track, and never lose your place across every streaming service.",
  metadataBase: new URL("https://show-seek.app"),
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ShowSeek",
  },
  openGraph: {
    title: "ShowSeek | Track Your Movies and Shows",
    description:
      "Discover, track, and never lose your place across every streaming service.",
    url: "https://show-seek.app/",
    siteName: "ShowSeek",
    images: [
      {
        url: "https://show-seek.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "ShowSeek | Track Your Movies and Shows",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShowSeek | Track Your Movies and Shows",
    description:
      "Discover, track, and never lose your place across every streaming service.",
    images: ["https://show-seek.app/og-image.png"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          async
          defer
        />
      </head>
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
