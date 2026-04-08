import './globals.css'
import { AlertProvider } from '@/components/Alert'
import AppHeader from '@/components/AppHeader'
import ThemeProvider from '@/components/ThemeProvider'

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="bg-zinc-50 text-zinc-900 transition-colors duration-300">
        <ThemeProvider>
          <AlertProvider>
            <AppHeader />
            {children}
          </AlertProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
