"use client"
import { useState } from 'react'
import { useDesktopStore, AppId } from '@/store/useStore'
import { motion, AnimatePresence } from 'framer-motion'
import { Folder, PenTool, CheckSquare, Calendar, Settings, FileText, ChevronUp, ChevronDown, GraduationCap } from 'lucide-react'

// Map AppId to Lucide Icon
const ICON_MAP = {
    notes: PenTool,
    tasks: CheckSquare,

    calendar: Calendar,
    pdf: FileText,
    settings: Settings,
    docs: FileText,
    study: GraduationCap,
}

export default function Dock() {
    const { windows, focusWindow, openWindow, activeWindowId, minimizeWindow } = useDesktopStore()

    const apps = Array.from(new Set(windows.map(w => w.appId)))

    const handleDockClick = (appId: AppId) => {
        const appWindows = windows.filter(w => w.appId === appId)

        if (appWindows.length === 0) {
            openWindow(appId)
            return
        }

        // Check if the currently active window belongs to this app
        const activeAppWindow = appWindows.find(w => w.id === activeWindowId && !w.isMinimized)

        if (activeAppWindow) {
            // If it's active and focused, minimize it
            minimizeWindow(activeAppWindow.id)
        } else {
            // If it's not active (minimized or background), bring to front
            // Find the window with highest zIndex to restore the "topmost" one of this app
            const topWindow = [...appWindows].sort((a, b) => b.zIndex - a.zIndex)[0]
            if (topWindow) {
                focusWindow(topWindow.id)
            }
        }
    }

    const [isMinimized, setIsMinimized] = useState(true)

    return (
        <div className="absolute bottom-6 left-6 z-[9999] flex flex-col-reverse items-start pointer-events-none w-auto gap-2">

            <motion.button
                layout
                onClick={() => setIsMinimized(!isMinimized)}
                className="pointer-events-auto bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-full p-1.5 shadow-[2px_2px_0px_var(--accent-espresso)] hover:scale-110 active:scale-95 transition-transform z-50 flex items-center justify-center"
                whileHover={{ y: -2 }}
            >
                {isMinimized ? (
                    <ChevronUp size={16} className="text-[var(--accent-espresso)]" strokeWidth={3} />
                ) : (
                    <ChevronDown size={16} className="text-[var(--accent-espresso)]" strokeWidth={3} />
                )}
            </motion.button>

            <AnimatePresence>
                {!isMinimized && (
                    <motion.div
                        initial={{ y: 20, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 20, opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", bounce: 0.3, duration: 0.4 }}
                        className="bg-[var(--bg-surface)]/90 backdrop-blur-md border-[3px] border-[var(--accent-espresso)] rounded-2xl px-4 py-2 flex items-end gap-3 pointer-events-auto shadow-[0px_8px_0px_rgba(58,42,32,0.1)] origin-bottom-left"
                    >
                        {apps.map(appId => {
                            const isRunning = windows.some(w => w.appId === appId)
                            const isActive = windows.some(w => w.appId === appId && w.id === activeWindowId && !w.isMinimized)
                            const Icon = ICON_MAP[appId]

                            return (
                                <motion.div
                                    key={appId}
                                    className="relative group cursor-pointer flex flex-col items-center gap-1 p-1"
                                    onClick={() => handleDockClick(appId)}
                                    whileHover={{ y: -10, scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                >
                                    <div className={`p-2.5 rounded-xl flex items-center justify-center transition-all duration-200 ${isActive ? 'bg-[var(--cream-highlight)] border-2 border-[var(--accent-espresso)] shadow-[4px_4px_0px_var(--accent-espresso)] -translate-y-2' : 'hover:bg-[var(--accent-espresso)]/5'}`}>
                                        <Icon className="text-[var(--accent-espresso)] w-7 h-7" strokeWidth={2.5} />
                                    </div>
                                    <div className={`w-1.5 h-1.5 bg-[var(--accent-espresso)] rounded-full transition-opacity duration-300 ${isRunning ? 'opacity-100' : 'opacity-0'}`} />
                                </motion.div>
                            )
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
