import React from 'react';
import Link from 'next/link';

interface CategoryCardProps {
  category: any;
  orgSlug: string;
}

export function CategoryCard({ category: cat, orgSlug }: CategoryCardProps) {
  return (
    <Link
      href={`/${orgSlug}/products?category=${cat.id}`}
      className="group relative flex flex-col justify-end overflow-hidden rounded-2xl border border-stone-200/80 bg-white/85 backdrop-blur-sm p-6 h-56 transition-all duration-500 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-amber-500/10 hover:border-amber-400 hover:bg-amber-50/70"
    >
      {/* Default light gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-white/80 to-stone-50/50 z-0 opacity-100 group-hover:opacity-0 transition-opacity duration-500" />
      
      {/* Light warm amber hover glow overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-amber-100/50 to-amber-50/80 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {cat.imageUrl && (
        <img
          src={cat.imageUrl}
          alt={cat.name}
          className="absolute inset-0 h-full w-full object-cover z-0 opacity-0 group-hover:opacity-20 group-hover:scale-105 transition-all duration-700 ease-out mix-blend-multiply"
        />
      )}
      
      <div className="relative z-20 transform transition-transform duration-500 group-hover:-translate-y-1">
        <h4 className="text-lg font-extrabold text-zinc-900 group-hover:text-amber-950 transition-colors duration-500">
          {cat.name}
        </h4>
        {cat.description && (
          <p className="text-xs font-medium text-zinc-500 mt-2 line-clamp-2 opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 group-hover:text-amber-900/80 transition-all duration-500 delay-100">
            {cat.description}
          </p>
        )}
      </div>
      
      {/* Decorative arrow icon */}
      <div className="absolute top-6 right-6 z-20 opacity-0 transform translate-x-4 -translate-y-4 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-500 delay-150">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 text-white shadow-sm">
          <svg className="w-4 h-4 transform rotate-[-45deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
