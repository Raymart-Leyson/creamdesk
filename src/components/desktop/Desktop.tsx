"use client"
import MenuBar from './MenuBar'
import IconsNetwork from './IconsNetwork'
import WindowManager from './WindowManager'
import Dock from './Dock'
import { useDesktopStore } from '@/store/useStore'

export default function Desktop() {
    const { theme } = useDesktopStore()

    return (
        <div className={`fixed inset-0 h-screen w-screen overflow-hidden bg-[var(--bg-cream)] flex flex-col relative select-none ${theme === 'dark-choco' ? 'dark-choco' : ''}`}>
            <MenuBar />
            <div className="flex-1 relative overflow-hidden">
                {/* Playful Wallpaper Pattern (Subtle dots) */}
                <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(var(--accent-espresso) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                />

                <IconsNetwork />
                <WindowManager />
                <Dock />
            </div>
        </div>
    )
}
