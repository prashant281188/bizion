import { Button } from '@/components/ui/button';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { getInitials } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LogOut, User } from 'lucide-react';

export function PortalTopbar() {
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

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navItems = [
    { name: 'Dashboard', href: '/portal' },
    { name: 'My Orders', href: '/portal/orders' },
    { name: 'My Invoices', href: '/portal/invoices' },
    { name: 'My Payments', href: '/portal/payments' },
    { name: 'Ledger', href: '/portal/ledger' },
    { name: 'Products & Pricing', href: '/portal/products' },
  ];

  return (
    <header className="sticky top-0 z-[60] w-full border-b border-zinc-200/50 bg-white/90 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 transition-all duration-200 shadow-sm">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Section: Logo & Name */}
        <div className="flex items-center space-x-8 min-w-max">
          <Link href="/portal" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-white font-bold shadow-sm ring-1 ring-amber-700/20">
              {user?.companyName ? user.companyName.charAt(0).toUpperCase() : 'C'}
            </div>
            <div className="hidden sm:flex sm:flex-col">
              <span className="text-lg font-bold tracking-tight text-zinc-900 leading-none mb-1">
                {user?.companyName || 'Client Portal'}
              </span>
              {user?.gstin && (
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider leading-none">
                  GST: {user.gstin}
                </span>
              )}
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/portal' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    isActive 
                      ? 'bg-amber-50 text-amber-700 shadow-sm' 
                      : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: User Details Dropdown */}
        <div className="flex items-center space-x-4 min-w-max">
          {/* User Account Menu */}
          <div className="relative" ref={dropdownRef}>
            <Button variant="ghost"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-3 rounded-full py-1.5 pr-2 pl-3 hover:bg-zinc-100 transition-all duration-200 border border-transparent hover:border-zinc-200 h-auto"
            >
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-zinc-900 leading-none mb-1">
                  {user?.companyName || 'Corporate Account'}
                </p>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider leading-none">
                  {user ? `${user.firstName} ${user.lastName || ''}` : 'Customer'}
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700 shadow-md ring-2 ring-white">
                {user?.companyName ? getInitials(user.companyName) : (user ? getInitials(`${user.firstName} ${user.lastName || ''}`) : 'C')}
              </div>
            </Button>

            {/* Dropdown Menu Overlay */}
            {dropdownOpen && (
              <>
                <div className="absolute right-0 mt-2 w-56 origin-top-right rounded-xl border border-zinc-200 bg-white p-1 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-3 border-b border-zinc-100 mb-1">
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Signed in as</p>
                    <p className="text-sm font-bold text-zinc-900 truncate">{user?.email}</p>
                  </div>
                  
                  {/* Mobile Navigation Links */}
                  <div className="md:hidden border-b border-zinc-100 pb-1 mb-1">
                    {navItems.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setDropdownOpen(false)}
                        className={`block px-4 py-2 text-sm font-medium rounded-lg ${
                          pathname === item.href || (item.href !== '/portal' && pathname?.startsWith(item.href))
                            ? 'bg-amber-50 text-amber-700'
                            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                        }`}
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>

                  <div className="p-1">
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg"
                      onClick={() => { setDropdownOpen(false); router.push('/portal/profile'); }}
                    >
                      <User className="mr-2 h-4 w-4" />
                      My Profile
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => { setDropdownOpen(false); handleLogout(); }}
                      className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg mt-1"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Log out
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
