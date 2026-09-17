'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar as ShadcnSidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  ShoppingCart,
  FileText,
  CreditCard,
  Package,
  User,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function PortalSidebar(props: React.ComponentProps<typeof ShadcnSidebar>) {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile } = useSidebar();

  const navGroups: NavGroup[] = [
    {
      label: 'Portal',
      items: [
        { name: 'Dashboard', href: '/portal', icon: LayoutDashboard },
        { name: 'My Orders', href: '/portal/orders', icon: ShoppingCart },
        { name: 'My Invoices', href: '/portal/invoices', icon: FileText },
        { name: 'My Payments', href: '/portal/payments', icon: CreditCard },
        { name: 'Products & Pricing', href: '/portal/products', icon: Package },
      ],
    },
    {
      label: 'Account',
      items: [
        { name: 'Profile Settings', href: '/portal/profile', icon: User },
      ],
    },
  ];

  return (
    <ShadcnSidebar collapsible="icon" {...props} className="bg-slate-900 border-r border-slate-800 text-slate-300">
      <SidebarHeader className="flex h-16 items-center justify-center border-b border-slate-800 px-4">
        {state === 'expanded' ? (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-slate-900 font-bold">
              C
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Customer Portal</span>
          </div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-slate-900 font-bold">
            C
          </div>
        )}
      </SidebarHeader>
      
      <SidebarContent className="gap-0 py-4 custom-scrollbar">
        {navGroups.map((group) => {
          return (
            <SidebarGroup key={group.label} className="pt-2">
              <SidebarGroupLabel className="px-4 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/portal' && pathname.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.name} className="px-2">
                        <SidebarMenuButton
                          isActive={isActive}
                          tooltip={state === 'collapsed' ? item.name : undefined}
                          className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-amber-500/10 text-amber-500 font-medium'
                              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                          }`}
                          onClick={() => {
                            if (isMobile) setOpenMobile(false);
                          }}
                        >
                          <Link href={item.href} className="flex items-center gap-3 w-full">
                            <item.icon className={`h-5 w-5 ${isActive ? 'text-amber-500' : 'text-slate-400'}`} />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </ShadcnSidebar>
  );
}
