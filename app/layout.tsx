import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Jedro+ Davčna Blagajna',
  description: 'Davčna blagajna za Jedro+ podjetja',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sl">
      <body className={`${inter.className} bg-gray-50 min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}
