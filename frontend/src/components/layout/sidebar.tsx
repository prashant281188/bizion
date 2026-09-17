'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_NAME } from '@/lib/constants';
import { usePermissions } from '@/hooks/usePermissions';
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
  Users,
  CreditCard,
  Box,
  Package,
  Truck,
  LineChart,
  History,
  TrendingUp,
  Activity,
  Database,
  Shield,
  Settings,
  Tags,
  List,
  Calculator,
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  minRole?: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function Sidebar(props: React.ComponentProps<typeof ShadcnSidebar>) {
  const pathname = usePathname();
  const { hasMinRole } = usePermissions();
  const { state, isMobile, setOpenMobile } = useSidebar();

  const navGroups: NavGroup[] = [
    {
      label: 'Main',
      items: [
        { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Sales & Orders',
      items: [
        { name: 'Orders', href: '/dashboard/orders/sales', minRole: 'agent', icon: ShoppingCart },
        { name: 'Invoices', href: '/dashboard/invoices', minRole: 'agent', icon: FileText },
        { name: 'Contacts', href: '/dashboard/contacts', minRole: 'agent', icon: Users },
        { name: 'Visit Planner', href: '/dashboard/visit-planner', minRole: 'agent', icon: TrendingUp },
        { name: 'Payments', href: '/dashboard/payments', minRole: 'accountant', icon: CreditCard },
      ],
    },
    {
      label: 'Inventory & Operations',
      items: [
        { name: 'Inventory', href: '/dashboard/inventory/stock', minRole: 'manager', icon: Box },
        { name: 'Products', href: '/dashboard/products', minRole: 'manager', icon: Package },
        { name: 'Bulk Price Editor', href: '/dashboard/products/bulk-pricing', minRole: 'manager', icon: Calculator },
        { name: 'Price Lists', href: '/dashboard/products/price-lists', minRole: 'manager', icon: List },
        { name: 'Promotions', href: '/dashboard/products/schemes', minRole: 'manager', icon: Tags },
        { name: 'Dispatches', href: '/dashboard/dispatches', minRole: 'manager', icon: Truck },
        { name: 'Transporters', href: '/dashboard/transporters', minRole: 'manager', icon: Truck },
      ],
    },
    {
      label: 'Analytics & Reports',
      items: [
        { name: 'Reports', href: '/dashboard/reports', icon: LineChart },
        { name: 'Price Revisions', href: '/dashboard/reports/price-revisions', minRole: 'manager', icon: History },
        { name: 'Customer Analytics', href: '/dashboard/analytics/customers', icon: TrendingUp },
        { name: 'Product Analytics', href: '/dashboard/analytics/products', icon: Activity },
      ],
    },
    {
      label: 'System & Administration',
      items: [
        { name: 'Masters', href: '/dashboard/masters', minRole: 'admin', icon: Database },
        { name: 'Team & Roles', href: '/dashboard/users', minRole: 'admin', icon: Shield },
        { name: 'Portal Users', href: '/dashboard/portal-users', minRole: 'admin', icon: Users },
        { name: 'Settings', href: '/dashboard/settings', minRole: 'admin', icon: Settings },
      ],
    },
  ];

  return (
    <ShadcnSidebar className="border-r border-zinc-200/80 bg-white" {...props}>
      <SidebarHeader className="h-16 flex items-center px-4 justify-between border-b border-zinc-100">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-700 to-amber-800 text-white font-extrabold flex items-center justify-center text-sm shadow-md shadow-amber-600/20">
            B
          </div>
          {state !== 'collapsed' && (
            <div className="flex flex-col">
              <span className="font-extrabold text-sm text-zinc-900 tracking-wider font-mono uppercase">
                {APP_NAME}
              </span>
              <span className="text-[9px] font-bold text-amber-700 uppercase tracking-widest -mt-0.5">
                ERP Console
              </span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 custom-scrollbar">
        {navGroups.map((group, index) => {
          const groupItems = group.items.filter((item) => !item.minRole || hasMinRole(item.minRole));
          if (groupItems.length === 0) return null;

          const allItems = navGroups.flatMap(g => g.items);
          const activeItem = allItems
            .filter(i => pathname === i.href || (pathname?.startsWith(i.href + '/') && i.href !== '/dashboard'))
            .sort((a, b) => b.href.length - a.href.length)[0];

          return (
            <React.Fragment key={group.label}>
              {index > 0 && <div className="h-px bg-zinc-100 mx-2 my-2.5" />}
              <SidebarGroup className="p-0">
                <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-3 py-1.5">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {groupItems.map((item) => {
                      const isActive = activeItem?.href === item.href;
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton 
                            render={<Link href={item.href} />} 
                            isActive={isActive} 
                            tooltip={item.name}
                            onClick={() => {
                              if (isMobile) {
                                setOpenMobile(false);
                              }
                            }}
                            className={`h-9 px-3 text-xs font-semibold rounded-xl transition-all ${
                              isActive 
                                ? "!bg-amber-600 !text-white font-bold shadow-md shadow-amber-600/25 data-[active=true]:!bg-amber-600 data-[active=true]:!text-white hover:!bg-amber-600 hover:!text-white" 
                                : "!text-zinc-700 hover:!bg-zinc-100 hover:!text-zinc-900"
                            }`}
                          >
                            <item.icon className={`w-4 h-4 shrink-0 ${isActive ? '!text-white' : '!text-zinc-500 group-hover:!text-zinc-900'}`} />
                            <span className={isActive ? '!text-white' : ''}>{item.name}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </React.Fragment>
          );
        })}
      </SidebarContent>
    </ShadcnSidebar>
  );
}
