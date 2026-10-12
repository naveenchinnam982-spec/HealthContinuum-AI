import { NavLink, Link } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  GitCompareArrows,
  CalendarCheck,
  ShieldCheck,
  ScrollText,
  Settings,
  Activity,
  Menu,
  X,
  LogOut,
  Bell,
  Search,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { DemoBanner } from '@/components/ui';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  { to: '/doctor/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/doctor/patients', label: 'Patients', icon: Users },
  { to: '/doctor/shared-records', label: 'Shared Records', icon: FileText },
  { to: '/doctor/continuity-review', label: 'OCR & Verification', icon: GitCompareArrows },
  { to: '/doctor/follow-ups', label: 'Follow-ups', icon: CalendarCheck },
  { to: '/doctor/access-consent', label: 'Access & Consent', icon: ShieldCheck },
  { to: '/doctor/audit-history', label: 'Audit History', icon: ScrollText },
  { to: '/doctor/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { doctor, signOut, isDemoMode } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-navy-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-navy-200 bg-white lg:flex lg:flex-col">
        <SidebarContent doctor={doctor} isDemoMode={isDemoMode} onSignOut={signOut} />
      </aside>

      {/* Mobile sidebar */}
      {mobileNavOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-navy-900/40 lg:hidden" onClick={() => setMobileNavOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-navy-200 bg-white lg:hidden animate-slide-in">
            <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
              <Logo />
              <button onClick={() => setMobileNavOpen(false)} className="rounded-md p-1.5 text-navy-500 hover:bg-navy-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent doctor={doctor} isDemoMode={isDemoMode} onSignOut={signOut} />
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-navy-200 bg-white/95 backdrop-blur">
          {isDemoMode && <DemoBanner />}
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNavOpen(true)}
                className="rounded-md p-1.5 text-navy-600 hover:bg-navy-100 lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden sm:block">
                <SearchBar />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                to="/doctor/access-consent"
                className="relative rounded-md p-2 text-navy-600 hover:bg-navy-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute right-1 top-1 flex h-2 w-2 rounded-full bg-teal-500" />
              </Link>
              <div className="flex items-center gap-2.5 border-l border-navy-200 pl-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-700 text-xs font-semibold text-white">
                  {doctor?.avatarInitials}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-navy-900">{doctor?.fullName}</p>
                  <p className="text-2xs text-navy-500">{doctor?.specialty}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600">
        <Activity className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-sm font-bold text-navy-900">HealthContinuum</p>
        <p className="text-2xs text-teal-600 font-medium">AI Doctor Portal</p>
      </div>
    </div>
  );
}

function SidebarContent({ doctor, isDemoMode, onSignOut }: { doctor: ReturnType<typeof useAuth>['doctor']; isDemoMode: boolean; onSignOut: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-navy-100 px-4 py-4">
        <Logo />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-navy-600 hover:bg-navy-50 hover:text-navy-900'
              }`
            }
          >
            <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-navy-100 p-3">
        <div className="mb-2 rounded-lg bg-navy-50 px-3 py-2">
          <p className="text-2xs font-semibold uppercase tracking-wide text-navy-500">Facility</p>
          <p className="mt-0.5 text-xs text-navy-700">{doctor?.facilityName || 'Not configured'}</p>
        </div>
        {isDemoMode && (
          <div className="mb-2 rounded-lg bg-warning-50 px-3 py-1.5">
            <p className="text-2xs font-semibold text-warning-700">Demo Mode</p>
          </div>
        )}
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-navy-600 transition-all hover:bg-error-50 hover:text-error-700"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function SearchBar() {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-400" />
      <input
        type="text"
        placeholder="Search patients, records..."
        className="w-64 rounded-lg border border-navy-200 bg-navy-50 py-2 pl-9 pr-3 text-sm text-navy-900 placeholder:text-navy-400 transition-all focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        aria-label="Global search"
      />
    </div>
  );
}
