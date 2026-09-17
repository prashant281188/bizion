import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, label, error, value, ...props }: React.ComponentProps<"input"> & { label?: string; error?: string }) {
  const inputElement = (
    <InputPrimitive
      type={type}
      data-slot="input"
      value={value !== undefined ? value : undefined}
      className={cn(
        "w-full min-w-0 rounded-lg border border-input bg-white px-3 py-2 text-sm text-zinc-900 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-zinc-400 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 md:text-sm",
        error ? "border-destructive focus-visible:ring-destructive/20 focus-visible:border-destructive" : "",
        className,
        "h-10"
      )}
      {...props}
    />
  )

  if (!label && !error) {
    return inputElement;
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
          {label}
        </label>
      )}
      {inputElement}
      {error && <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>}
    </div>
  )
}

export { Input }
