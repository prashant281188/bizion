'use client';
import { Button } from '@/components/ui/button';


// ============================================================
// Bizion — Landing Page (Phase 1 Placeholder)
// ============================================================

import { useEffect, useState } from 'react';

const FEATURES = [
  {
    icon: '📊',
    title: 'GST Invoicing',
    description: 'Create GST-compliant invoices with automatic tax calculations and e-invoicing support.',
  },
  {
    icon: '📦',
    title: 'Inventory Management',
    description: 'Track stock across warehouses with real-time updates, low-stock alerts, and batch management.',
  },
  {
    icon: '👥',
    title: 'Contact Management',
    description: 'Manage customers and vendors with credit tracking, outstanding balances, and communication history.',
  },
  {
    icon: '💰',
    title: 'Payment Tracking',
    description: 'Record payments with multi-invoice allocation, automatic reconciliation, and payment reminders.',
  },
  {
    icon: '📈',
    title: 'Financial Reports',
    description: 'Real-time dashboards with revenue analytics, tax reports, and profit & loss statements.',
  },
  {
    icon: '🔐',
    title: 'Role-Based Access',
    description: 'Granular permissions for your team — from owners and admins to accountants and sales staff.',
  },
];

const STATS = [
  { value: '10K+', label: 'Businesses' },
  { value: '₹50Cr+', label: 'Processed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.9★', label: 'Rating' },
];

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ===== Animated Background ===== */}
      <div className="fixed inset-0 -z-10">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-surface-950 via-brand-950 to-surface-950" />

        {/* Animated orbs */}
        <div
          className="absolute top-1/4 -left-20 h-96 w-96 rounded-full bg-brand-600/20 blur-[128px]"
          style={{ animation: 'float 8s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-1/4 -right-20 h-96 w-96 rounded-full bg-accent-500/20 blur-[128px]"
          style={{ animation: 'float 10s ease-in-out infinite 2s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success-500/10 blur-[100px]"
          style={{ animation: 'float 12s ease-in-out infinite 4s' }}
        />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* ===== Navigation ===== */}
      <nav className="relative z-10" role="navigation" aria-label="Main navigation">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 shadow-glow-brand">
              <span className="text-xl font-bold text-white">B</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-surface-50">
              Bizion
            </span>
          </div>

          {/* Nav Links */}
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              id="nav-features"
              className="text-sm font-medium text-surface-400 transition-colors duration-200 hover:text-surface-50"
            >
              Features
            </a>
            <a
              href="#stats"
              id="nav-stats"
              className="text-sm font-medium text-surface-400 transition-colors duration-200 hover:text-surface-50"
            >
              Why Bizion
            </a>
            <a
              href="/login"
              id="nav-login"
              className="text-sm font-medium text-surface-300 transition-colors duration-200 hover:text-surface-50"
            >
              Sign In
            </a>
            <a
              href="/register"
              id="nav-get-started"
              className="rounded-lg bg-gradient-to-r from-brand-600 to-accent-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-brand transition-all duration-300 hover:shadow-glow-accent hover:brightness-110"
            >
              Get Started
            </a>
          </div>

          {/* Mobile menu button */}
          <Button variant="ghost"
            id="mobile-menu-btn"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-surface-400 transition-colors hover:bg-glass-light hover:text-surface-50 md:hidden"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </Button>
        </div>
      </nav>

      {/* ===== Hero Section ===== */}
      <main>
        <section
          className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-16 sm:pt-24 lg:pt-32"
          aria-labelledby="hero-heading"
        >
          <div
            className={`mx-auto max-w-4xl text-center transition-all duration-1000 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
            }`}
          >
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-1.5 text-sm text-brand-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success-400" />
              Now in Public Beta — Start Free
            </div>

            {/* Heading */}
            <h1 id="hero-heading" className="text-display mb-6">
              <span className="block text-surface-50">Manage Your</span>
              <span className="gradient-text block">Business Smarter</span>
            </h1>

            {/* Subtitle */}
            <p className="text-body-large mx-auto mb-10 max-w-2xl text-surface-400">
              The all-in-one platform for Indian businesses. GST invoicing,
              inventory management, payment tracking, and financial reporting
              — beautifully crafted and effortlessly powerful.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="/register"
                id="hero-get-started"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-brand-600 to-accent-600 px-8 py-4 text-base font-semibold text-white shadow-glow-brand transition-all duration-300 hover:shadow-glow-accent hover:brightness-110"
              >
                <span className="relative z-10">Get Started Free</span>
                <svg
                  className="relative z-10 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
                {/* Shine effect */}
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              </a>

              <a
                href="#features"
                id="hero-learn-more"
                className="glass inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-semibold text-surface-200 transition-all duration-300 hover:bg-glass-medium hover:text-white"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                See How It Works
              </a>
            </div>
          </div>

          {/* ===== Dashboard Preview Card ===== */}
          <div
            className={`mx-auto mt-20 max-w-5xl transition-all delay-300 duration-1000 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
            }`}
          >
            <div className="glass-heavy rounded-2xl p-1 shadow-elevated">
              <div className="rounded-xl bg-surface-900/80 p-6 sm:p-8">
                {/* Mock Dashboard Header */}
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-surface-50">Dashboard Overview</h3>
                    <p className="text-sm text-surface-400">Financial Year 2025-26</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-3 w-3 rounded-full bg-danger-500/60" />
                    <div className="h-3 w-3 rounded-full bg-warning-500/60" />
                    <div className="h-3 w-3 rounded-full bg-success-500/60" />
                  </div>
                </div>

                {/* Mock Stats Grid */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    { label: 'Revenue', value: '₹24,56,789', change: '+12.5%', positive: true },
                    { label: 'Invoices', value: '1,234', change: '+8.2%', positive: true },
                    { label: 'Outstanding', value: '₹3,45,678', change: '-5.1%', positive: true },
                    { label: 'Customers', value: '856', change: '+15.3%', positive: true },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-glass-border bg-glass-light p-4 transition-all duration-300 hover:bg-glass-medium"
                    >
                      <p className="text-xs font-medium text-surface-400">{stat.label}</p>
                      <p className="mt-1 text-xl font-bold text-surface-50 sm:text-2xl">{stat.value}</p>
                      <p className={`mt-1 text-xs font-medium ${
                        stat.positive ? 'text-success-400' : 'text-danger-400'
                      }`}>
                        {stat.change}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Mock Chart Area */}
                <div className="mt-6 rounded-xl border border-glass-border bg-glass-light p-6">
                  <div className="flex items-end justify-between gap-2" style={{ height: '120px' }}>
                    {[40, 65, 45, 80, 55, 70, 90, 60, 75, 85, 50, 95].map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-brand-600/80 to-accent-500/80 transition-all duration-500 hover:from-brand-500 hover:to-accent-400"
                        style={{
                          height: `${height}%`,
                          animationDelay: `${i * 100}ms`,
                        }}
                      />
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-xs text-surface-500">
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                    <span>Jul</span>
                    <span>Aug</span>
                    <span>Sep</span>
                    <span>Oct</span>
                    <span>Nov</span>
                    <span>Dec</span>
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Stats Section ===== */}
        <section id="stats" className="relative z-10 py-20" aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">
            Platform Statistics
          </h2>
          <div className="mx-auto max-w-5xl px-6">
            <div className="glass-medium rounded-2xl px-8 py-12 shadow-glass">
              <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
                {STATS.map((stat) => (
                  <div key={stat.label} className="text-center">
                    <p className="gradient-text text-3xl font-extrabold sm:text-4xl">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-sm font-medium text-surface-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== Features Section ===== */}
        <section
          id="features"
          className="relative z-10 py-24"
          aria-labelledby="features-heading"
        >
          <div className="mx-auto max-w-7xl px-6">
            {/* Section Header */}
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-400">
                Features
              </p>
              <h2 id="features-heading" className="text-headline mb-4 text-surface-50">
                Everything You Need to{' '}
                <span className="gradient-text-brand">Run Your Business</span>
              </h2>
              <p className="text-body-large text-surface-400">
                Purpose-built for Indian businesses with GST compliance, Indian
                accounting standards, and UPI payment tracking out of the box.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature, index) => (
                <article
                  key={feature.title}
                  className="glass group rounded-2xl p-6 shadow-glass-sm transition-all duration-500 hover:bg-glass-medium hover:shadow-glass"
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-2xl transition-transform duration-300 group-hover:scale-110">
                    {feature.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-surface-50">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-surface-400">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ===== CTA Section ===== */}
        <section className="relative z-10 py-24" aria-labelledby="cta-heading">
          <div className="mx-auto max-w-4xl px-6 text-center">
            <div className="glass-heavy rounded-3xl p-12 shadow-elevated sm:p-16">
              {/* Decorative gradient */}
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                <div className="h-32 w-64 rounded-full bg-gradient-to-r from-brand-500/30 to-accent-500/30 blur-3xl" />
              </div>

              <h2 id="cta-heading" className="text-headline relative mb-4 text-surface-50">
                Ready to Transform{' '}
                <span className="gradient-text-brand">Your Business?</span>
              </h2>
              <p className="relative mb-8 text-lg text-surface-400">
                Join thousands of Indian businesses already using Bizion to streamline
                their operations. Start your free trial today — no credit card required.
              </p>
              <div className="relative flex flex-col items-center justify-center gap-4 sm:flex-row">
                <a
                  href="/register"
                  id="cta-start-free"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-accent-600 px-8 py-4 text-base font-semibold text-white shadow-glow-brand transition-all duration-300 hover:shadow-glow-accent hover:brightness-110"
                >
                  Start Free Trial
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </a>
                <a
                  href="mailto:hello@bizion.in"
                  id="cta-contact-sales"
                  className="inline-flex items-center gap-2 rounded-xl px-8 py-4 text-base font-medium text-surface-300 transition-colors duration-300 hover:text-surface-50"
                >
                  Contact Sales →
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ===== Footer ===== */}
      <footer className="relative z-10 border-t border-glass-border py-12" role="contentinfo">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500">
              <span className="text-sm font-bold text-white">B</span>
            </div>
            <span className="text-sm font-semibold text-surface-300">Bizion</span>
          </div>
          <p className="text-sm text-surface-500">
            © {new Date().getFullYear()} Bizion. Built with ❤️ for Indian businesses.
          </p>
        </div>
      </footer>
    </div>
  );
}
