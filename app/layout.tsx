import { Footer } from "@/components/footer"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import NextTopLoader from "nextjs-toploader"
import { Toaster } from "sonner"
import "./globals.css"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "ShowSeek",
  description: "Discover, Track, and Share your favorite movies and TV shows",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} antialiased font-sans`}>
        <NextTopLoader color="#E50914" showSpinner={false} />
        {children}
        <Footer />
        <Toaster position="top-center" richColors theme="dark" />
      </body>
    </html>
  )
}
