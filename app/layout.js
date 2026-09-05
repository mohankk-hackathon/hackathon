import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800', '900'] })

export const metadata = {
  title: 'Finance Tracker',
  description: 'Track your income, expenses and budget beautifully',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
