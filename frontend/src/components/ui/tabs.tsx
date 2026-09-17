"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface TabsContextValue {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const TabsContext = React.createContext<TabsContextValue>({ activeTab: '', setActiveTab: () => {} })

function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  defaultValue?: string
  value?: string
  onValueChange?: (value: string) => void
}) {
  const [internalTab, setInternalTab] = React.useState(defaultValue ?? '')
  const activeTab = value ?? internalTab
  const setActiveTab = (tab: string) => {
    setInternalTab(tab)
    onValueChange?.(tab)
  }
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn("", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="border-b border-zinc-200">
      <div
        role="tablist"
        className={cn("-mb-px flex space-x-8 overflow-x-auto", className)}
        {...props}
      />
    </div>
  )
}

function TabsTrigger({
  value,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const { activeTab, setActiveTab } = React.useContext(TabsContext)
  const isActive = activeTab === value
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={cn(
        "whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-colors outline-none",
        isActive
          ? "border-amber-600 text-amber-700"
          : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

function TabsContent({
  value,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const { activeTab } = React.useContext(TabsContext)
  if (activeTab !== value) return null
  return (
    <div
      role="tabpanel"
      className={cn("mt-4", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
