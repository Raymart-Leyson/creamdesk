"use client"
import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'

interface DesktopIconProps {
    icon: LucideIcon
    label: string
    onClick: () => void
}

export default function DesktopIcon({ icon: Icon, label, onClick }: DesktopIconProps) {
    return (
        <motion.div
            className="flex flex-col items-center gap-2 w-28 p-2 rounded-xl hover:bg-white/30 transition-colors cursor-pointer group select-none m-2"
            onClick={onClick}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            <div className="w-16 h-16 bg-[var(--bg-cream)] border-2 border-[var(--accent-espresso)] rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_var(--accent-espresso)] group-hover:shadow-[6px_6px_0px_var(--accent-espresso)] transition-all relative overflow-hidden">
                {/* Shine effect */}
                <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 rounded-bl-full transform rotate-45 translate-x-2 -translate-y-2" />
                <Icon size={32} className="text-[var(--accent-espresso)]" strokeWidth={2.5} />
            </div>
            <span className="text-[var(--accent-espresso)] font-bold text-xs bg-[var(--bg-surface)]/80 px-2 py-0.5 rounded-md backdrop-blur-sm shadow-sm text-center leading-tight">
                {label}
            </span>
        </motion.div>
    )
}
