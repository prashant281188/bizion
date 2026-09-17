import React from 'react';
import { Card } from './card';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

export interface TableHeader {
  key: string;
  label: string;
  sortable?: boolean;
  widthClass?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

interface DataTableProps {
  headers: TableHeader[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  className?: string;
}

export function DataTable({
  headers,
  sortBy,
  sortOrder,
  onSort,
  isLoading,
  isEmpty,
  emptyMessage = 'No records found matching filters.',
  children,
  className,
}: DataTableProps) {
  const renderSortIcon = (key: string) => {
    if (sortBy !== key) return <span className="ml-1.5 text-zinc-400">↕</span>;
    return sortOrder === 'asc' ? <span className="ml-1.5 text-amber-600">▲</span> : <span className="ml-1.5 text-amber-600">▼</span>;
  };

  return (
    <Card className={cn("bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden", className)}>
      <Table>
        <TableHeader className="bg-zinc-50/80">
          <TableRow className="border-b border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-500 hover:bg-transparent">
            {headers.map((h) => {
              const alignClass = h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left';
              const cursorClass = h.sortable && onSort ? 'cursor-pointer select-none hover:bg-zinc-100/50' : '';
              return (
                <TableHead
                  key={h.key}
                  className={cn("px-3 py-3 md:px-6 md:py-4 transition-colors h-auto font-semibold", h.widthClass, alignClass, cursorClass, h.className)}
                  onClick={() => h.sortable && onSort && onSort(h.key)}
                >
                  <div className={cn("flex items-center", h.align === 'right' ? 'justify-end' : h.align === 'center' ? 'justify-center' : '')}>
                    {h.label}
                    {h.sortable && onSort && renderSortIcon(h.key)}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-zinc-100">
          {isLoading && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={headers.length} className="px-6 py-12 text-center">
                <div className="flex justify-center py-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-amber-600"></div>
                </div>
              </TableCell>
            </TableRow>
          )}
          {!isLoading && isEmpty && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={headers.length} className="px-6 py-12 text-center text-zinc-500">
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
          {!isLoading && !isEmpty && children}
        </TableBody>
      </Table>
    </Card>
  );
}
