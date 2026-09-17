'use client';

// ============================================================
// Bizion — Theme Provider
// ============================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = 'bizion-theme';

function getSystemTheme(): 'dark' | 'light' {
  return 'light';
}

function getStoredTheme(): Theme {
  return 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('light');
  const [mounted, setMounted] = useState(false);

  // Resolve the actual theme (system → dark/light)
  const resolveTheme = useCallback((t: Theme): 'dark' | 'light' => {
    return 'light';
  }, []);

  // Apply theme class to <html>
  const applyTheme = useCallback((resolved: 'dark' | 'light') => {
    const root = document.documentElement;
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
  }, []);

  // Initialize on mount
  useEffect(() => {
    setThemeState('light');
    setResolvedTheme('light');
    applyTheme('light');
    setMounted(true);
  }, [applyTheme]);

  // Listen for system theme changes
  useEffect(() => {
    // No-op, force light
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState('light');
      setResolvedTheme('light');
      applyTheme('light');
    },
    [applyTheme]
  );

  const toggleTheme = useCallback(() => {
    setTheme('light');
  }, [setTheme]);

  // Prevent flash of wrong theme
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider
      value={{ theme, resolvedTheme, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
