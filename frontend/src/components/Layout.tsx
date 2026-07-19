import { Outlet } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import Sidebar from './Sidebar'
import { useSocket } from '@/hooks/useSocket'
import { useToast } from './Toast'

export default function Layout() {
  const { toast } = useToast()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!mobileNavOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileNavOpen])

  useSocket('search:warning', (payload) => {
    const warning = payload as { code?: string; detail?: { indexer?: string; provider?: string } }
    if (warning.code !== 'rate_limited') return

    const source = warning.detail?.indexer || warning.detail?.provider || 'Indexer'
    toast(`${source} API quota or rate limit reached. Check Search Diagnostics.`, 'error')
  })

  return (
    <div className="flex h-screen overflow-hidden bg-[#090d12] text-gray-100">
      <a href="#main-content" className="sr-only z-[70] focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:rounded-md focus:bg-gray-100 focus:px-3 focus:py-2 focus:text-gray-950">
        Skip navigation
      </a>
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <button
        type="button"
        onClick={() => setMobileNavOpen(true)}
        className="fixed left-3 top-3 z-40 rounded-lg border border-white/10 bg-gray-900/95 p-2 text-gray-100 shadow-lg md:hidden"
        aria-label="Open navigation"
        aria-expanded={mobileNavOpen}
        aria-controls="mobile-navigation"
      >
        <Menu size={20} />
      </button>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          />
          <div id="mobile-navigation" className="relative h-full w-56">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="absolute right-2 top-2 rounded-md p-2 text-gray-300 hover:bg-white/10 hover:text-white"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      <main id="main-content" className="relative min-w-0 flex-1 overflow-y-auto">
        <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0)_22rem)]" />
        <div className="relative p-4 pt-16 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
