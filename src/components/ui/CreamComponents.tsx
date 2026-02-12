"use client"

import { forwardRef } from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

// Creamy Card Component
export const CreamCard = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-2xl shadow-[4px_4px_0px_var(--accent-espresso)] p-6",
            className
        )}
        {...props}
    />
))
CreamCard.displayName = "CreamCard"

// Creamy Button Component with Motion
export const CreamButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }>(({ className, variant = 'primary', ...props }, ref) => {
    const bgClass = variant === 'secondary' ? 'bg-[var(--accent-peach)]' : 'bg-[var(--bg-cream)]';

    return (
        <motion.button
            ref={ref}
            whileHover={{ y: -2, x: -2, boxShadow: "4px 4px 0px var(--accent-espresso)" }}
            whileTap={{ y: 0, x: 0, boxShadow: "0px 0px 0px var(--accent-espresso)" }}
            className={cn(
                "text-[var(--accent-espresso)] font-bold border-2 border-[var(--accent-espresso)] rounded-xl px-6 py-2 shadow-[2px_2px_0px_var(--accent-espresso)] transition-all select-none",
                bgClass,
                className
            )}
            {...props as any}
        />
    )
})
CreamButton.displayName = "CreamButton"

// Creamy Input Component
export const CreamInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
    <input
        ref={ref}
        className={cn(
            "bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent-peach)] w-full text-[var(--accent-espresso)] placeholder:text-[var(--accent-espresso)]/50 font-medium",
            className
        )}
        {...props}
    />
))
CreamInput.displayName = "CreamInput"
