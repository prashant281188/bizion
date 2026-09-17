'use client';

import React, { createContext, useContext } from 'react';

interface OrganizationPublicDetails {
  name: string;
  legalName?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  stateName?: string;
  pincode?: string;
  country?: string;
  settings?: {
    storefrontCarousel?: {
      badge?: string;
      title: string;
      desc?: string;
    }[];
    storefront?: {
      tagline?: string;
      announcementBar?: string;
      showAnnouncementBar?: boolean;
      exploreButtonText?: string;
      exploreButtonUrl?: string;
      requestQuoteButtonText?: string;
      requestQuoteButtonUrl?: string;
      aboutBadge?: string;
      aboutTitle?: string;
      aboutDescription?: string;
      aboutParagraph1?: string;
      aboutParagraph2?: string;
      contactBadge?: string;
      contactTitle?: string;
      contactDescription?: string;
      footerDescription?: string;
      trustBadges?: {
        title: string;
        description?: string;
      }[];
    };
  };
}

interface StorefrontContextValue {
  org: OrganizationPublicDetails;
  orgSlug: string;
}

const StorefrontContext = createContext<StorefrontContextValue | undefined>(undefined);

export function useStorefront() {
  const context = useContext(StorefrontContext);
  if (!context) {
    throw new Error('useStorefront must be used within a StorefrontProvider');
  }
  return context;
}

export function StorefrontProvider({
  children,
  org,
  orgSlug,
}: {
  children: React.ReactNode;
  org: OrganizationPublicDetails;
  orgSlug: string;
}) {
  return (
    <StorefrontContext.Provider value={{ org, orgSlug }}>
      {children}
    </StorefrontContext.Provider>
  );
}
