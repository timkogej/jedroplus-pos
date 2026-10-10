import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Jedro+ Davčna Blagajna',
  description: 'Davčna blagajna za Jedro+ podjetja',
}

// viewport-fit=cover lets the mobile bar respect the iPhone home-indicator inset.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sl">
      <body className="font-sans bg-[#f5f5f7] min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
