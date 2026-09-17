import type { Metadata, Viewport } from 'next';
import { Inter, Geist } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/providers/theme-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from 'sonner';
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'Bizion — Business Management Platform',
    template: '%s | Bizion',
  },
  description:
    'Modern business management platform for Indian businesses. Manage invoices, inventory, contacts, and accounting — all in one place.',
  keywords: [
    'business management',
    'invoice software',
    'GST billing',
    'inventory management',
    'accounting',
    'India',
    'B2B SaaS',
  ],
  authors: [{ name: 'Bizion' }],
  creator: 'Bizion',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  ),
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Bizion',
    title: 'Bizion — Business Management Platform',
    description:
      'Modern business management platform for Indian businesses.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bizion — Business Management Platform',
    description:
      'Modern business management platform for Indian businesses.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              {children}
              <Toaster position="top-right" richColors />
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
