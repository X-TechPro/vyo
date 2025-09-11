import type React from "react"
import type { Metadata, Viewport } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import "./globals.css"
import "katex/dist/katex.min.css"

export const metadata: Metadata = {
  title: "AI Chat Interface",
  description: "Premium AI Chat Interface with OpenRouter integration",
  keywords: ["AI", "chat", "OpenRouter", "assistant", "conversation"],
  authors: [{ name: "AI Chat Interface" }],
  creator: "AI Chat Interface",
  publisher: "AI Chat Interface",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: "/icon.svg?height=32&width=32",
    shortcut: "/icon.svg?height=16&width=16",
    apple: "/icon.svg?height=180&width=180",
  },
  other: {
    "theme-color": "#000000",
  },
}

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head></head>
      <body className={`${GeistSans.className} antialiased`}>{children}</body>
    </html>
  )
}
