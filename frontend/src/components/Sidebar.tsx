import { NavLink } from 'react-router-dom'
import logoSrc from '@/assets/logo.png'
import {
  LayoutDashboard,
  Film,
  Tv2,
  Activity,
  Download,
  AlertCircle,
  Radar,
  ShieldBan,
  Settings,
  Server,
  Container,
  LogOut,
  Coffee,
  Layers,
} from 'lucide-react'
import { auth } from '@/lib/auth'
import clsx from 'clsx'

const links = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/library', icon: Film, label: 'Library' },
  { to: '/tv', icon: Tv2, label: 'TV Shows' },
  { to: '/activity', icon: Activity, label: 'Activity' },
  { to: '/queue', icon: Download, label: 'Queue' },
  { to: '/queue/failed', icon: AlertCircle, label: 'Failed Downloads' },
  { to: '/queue/orphaned', icon: AlertCircle, label: 'Orphaned Downloads' },
  { to: '/system/operations', icon: Layers, label: 'Operations' },
  { to: '/system/search-diagnostics', icon: Radar, label: 'Search Diagnostics' },
  { to: '/system/container', icon: Container, label: 'Container' },
  { to: '/settings/blacklist', icon: ShieldBan, label: 'Blacklist' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/system', icon: Server, label: 'System' },
]

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

export default function Sidebar({ className, onNavigate }: SidebarProps) {
  return (
    <aside className={clsx(
      'flex h-full min-h-0 w-56 flex-col gap-1 border-r border-white/10 bg-[linear-gradient(180deg,#0d1721_0%,#0a121b_100%)] py-6 shadow-2xl shadow-black/40',
      className,
    )}>
      {/* Logo */}
      <div className="px-4 mb-6 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-300/20 bg-emerald-300/5">
          <img src={logoSrc} alt="Slimarr" className="h-7 w-auto" />
        </div>
        <span className="text-xl font-bold">
          <span className="text-brand-green">Slim</span>
          <span className="text-white">arr</span>
        </span>
      </div>

      <div className="px-4 pb-2 text-[10px] uppercase tracking-[0.16em] text-gray-500">Operations</div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-2">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            end={['/', '/queue', '/settings', '/system'].includes(to)}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-brand-green text-white shadow-[0_10px_28px_-14px_rgba(31,191,143,0.85)]'
                  : 'text-gray-300 hover:bg-white/[0.07] hover:text-white hover:translate-x-[1px]'
              )
            }
          >
            <Icon size={18} className="shrink-0 opacity-90 group-hover:opacity-100" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto mx-2 flex flex-col gap-1">
        <button
          onClick={() => {
            auth.removeToken()
            window.location.href = '/login'
          }}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-white/[0.07] hover:text-white"
        >
          <LogOut size={18} />
          Sign Out
        </button>

        {/* Donate */}
        <a
          href="https://www.paypal.com/donate/?business=XH8CKYF8T7EBU&no_recurring=0&item_name=Thank+you+for+your+generous+donation%2C+this+will+allow+me+to+continue+developing+my+programs.&currency_code=AUD"
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-1.5 text-xs text-yellow-200 transition-colors hover:bg-yellow-500/10"
        >
          <Coffee size={14} />
          Donate
        </a>

        {/* Creator credit */}
        <a
          href="https://matthurley.dev"
          target="_blank"
          rel="noreferrer"
          className="block text-center text-xs text-gray-600 hover:text-gray-400 transition-colors px-2 py-2"
        >
          Created by Matt Hurley
        </a>
      </div>
    </aside>
  )
}
