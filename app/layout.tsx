import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Hugging Face Model Repository',
  description: 'Download and manage Hugging Face models locally',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

