"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  warning?: string | null
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  warning,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = 'default',
  loading = false
}: ConfirmDialogProps) {
  const isDestructive = variant === 'destructive';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md bg-white p-6 sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className={`text-lg font-bold ${isDestructive ? 'text-red-600' : 'text-zinc-900'}`}>
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-2 text-sm text-zinc-600 space-y-4">
          {description && <p>{description}</p>}
          
          {warning !== null && (warning || isDestructive) && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200/60 p-3 rounded-lg text-amber-900 font-medium text-xs sm:text-sm">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="leading-snug">
                <strong className="block uppercase tracking-wider text-[11px] text-amber-800 mb-0.5">Warning</strong>
                {warning || "This action cannot be undone and may result in permanent data loss."}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 mt-2 border-t border-zinc-100">
          <Button 
            type="button"
            variant="outline" 
            onClick={onClose} 
            disabled={loading}
            className="text-zinc-600"
          >
            {cancelText}
          </Button>
          <Button 
            type="button"
            variant={isDestructive ? 'destructive' : 'default'} 
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
