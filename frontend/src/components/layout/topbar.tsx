import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { getInitials } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { GlobalSearch } from './global-search';

export function Topbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on route change
  useEffect(() => {
    setDropdownOpen(false);
  }, [pathname]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Derive page title from path
  const getPageTitle = () => {
    if (!pathname) return 'Overview';
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return 'Overview';
    const segment = segments[1];
    return segment.charAt(0).toUpperCase() + segment.slice(1);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="flex h-16 z-40 relative items-center justify-between border-b border-zinc-200/80 bg-white/80 px-6 backdrop-blur-xl gap-4">
      {/* Left Section: Menu Toggle + Dynamic Page Context Badge */}
      <div className="flex items-center space-x-3 min-w-max">
        <SidebarTrigger className="-ml-1 text-zinc-600 hover:text-zinc-900" />
        <div className="h-4 w-px bg-zinc-200 hidden md:block" />
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-xl bg-zinc-100/80 border border-zinc-200/80 text-xs font-bold text-zinc-800">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>{getPageTitle()}</span>
        </div>
      </div>

      {/* Center Section: Global Search */}
      <div className="flex-1 flex justify-center max-w-xl w-full">
        <GlobalSearch />
      </div>

      {/* Right Section: User Profile Dropdown */}
      <div className="flex items-center space-x-4 min-w-max">
        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2.5 rounded-xl py-1.5 pl-2 pr-3 hover:bg-zinc-100 transition-all duration-200 h-auto border border-zinc-200/80 bg-white shadow-2xs"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-amber-600 to-amber-700 text-xs font-bold text-white shadow-sm">
              {user ? getInitials(`${user.firstName} ${user.lastName || ''}`) : 'U'}
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-xs font-bold text-zinc-900 leading-none mb-0.5">
                {user ? `${user.firstName} ${user.lastName || ''}` : 'User'}
              </p>
              <p className="text-[9px] text-amber-700 uppercase font-bold tracking-wider leading-none">
                {user ? user.role : 'Staff'}
              </p>
            </div>
            <svg className="h-4 w-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </Button>

          {/* Dropdown Menu Overlay */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 origin-top-right rounded-2xl border border-zinc-200/80 bg-white p-1.5 shadow-xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="relative z-10 px-3.5 py-2.5 border-b border-zinc-100 mb-1 bg-zinc-50/50 rounded-xl">
                <p className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Signed in as</p>
                <p className="text-xs font-bold text-zinc-900 truncate">{user?.email}</p>
              </div>
              
              <div className="relative z-10 space-y-0.5">
                <Link
                  href="/dashboard/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex w-full items-center rounded-xl px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                >
                  Organization Settings
                </Link>
                
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center justify-start rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-left"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
