'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/components/ThemeProvider'

const NAV_ITEMS = [
  { href: '/', label: 'Predict' },
  { href: '/admin', label: 'Admin' },
]

export default function AppHeader() {
  const pathname = usePathname()
  const { isDark, toggleTheme } = useTheme()

  return (
    <header className={`sticky top-0 z-50 border-b backdrop-blur transition-colors ${isDark ? 'border-zinc-800/80 bg-zinc-950/90' : 'border-zinc-200/80 bg-white/90'}`}>
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
        <div>
          <p className={`text-sm font-semibold tracking-wide ${isDark ? 'text-zinc-100' : 'text-zinc-900'}`}>Painel de Obesidade</p>
          <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>Navegue entre Predict e Admin</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${isDark ? 'border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800' : 'border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100'}`}>
            {isDark ? '☀️ Claro' : '🌙 Escuro'}
          </button>

          <nav className={`flex items-center gap-2 rounded-xl border p-1 transition-colors ${isDark ? 'border-zinc-700 bg-zinc-900/80' : 'border-zinc-200 bg-zinc-100/80'}`}>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? isDark
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'bg-white text-zinc-900 shadow-sm'
                      : isDark
                        ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                        : 'text-zinc-600 hover:bg-white/70 hover:text-zinc-900'
                  }`}>
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}
