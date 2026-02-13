import { create } from 'zustand'

export type AppId = 'calendar' | 'notes' | 'tasks' | 'pdf' | 'settings' | 'docs' | 'study'

export interface WindowState {
    id: string
    appId: AppId
    title: string
    isOpen: boolean
    isMinimized: boolean
    zIndex: number
    position: { x: number; y: number }
    size: { width: number; height: number }
    isMaximized: boolean
    props?: any
}

interface DesktopStore {
    windows: WindowState[]
    activeWindowId: string | null
    zIndexCounter: number
    theme: 'cream' | 'dark-choco'
    setTheme: (theme: 'cream' | 'dark-choco') => void
    openWindow: (appId: AppId, props?: any) => void
    closeWindow: (id: string) => void
    focusWindow: (id: string) => void
    minimizeWindow: (id: string) => void
    toggleMaximizeWindow: (id: string) => void
    updateWindowPosition: (id: string, position: { x: number; y: number }) => void
    updateWindowSize: (id: string, size: { width: number; height: number }) => void
}

const DEFAULT_SIZE = { width: 1000, height: 800 }
const DEFAULT_POS = { x: 100, y: 50 }

export const useDesktopStore = create<DesktopStore>((set) => ({
    windows: [],
    activeWindowId: null,
    zIndexCounter: 100,
    theme: 'cream',
    setTheme: (theme) => set({ theme }),

    openWindow: (appId, props) => set((state) => {
        // Check if window exists and is just minimized (optional: allow multiple instances for notes?)
        // For MVP, single instance per app except maybe Notes. Let's do unique ID every time for flexibility.
        const id = `${appId}-${Date.now()}`
        const newWindow: WindowState = {
            id,
            appId,
            title: appId.charAt(0).toUpperCase() + appId.slice(1),
            isOpen: true,
            isMinimized: false,
            zIndex: state.zIndexCounter + 1,
            position: { x: DEFAULT_POS.x + (state.windows.length * 20), y: DEFAULT_POS.y + (state.windows.length * 20) }, // Staggered
            size: DEFAULT_SIZE,
            isMaximized: true,
            props
        }
        return {
            windows: [...state.windows, newWindow],
            activeWindowId: id,
            zIndexCounter: state.zIndexCounter + 1
        }
    }),

    closeWindow: (id) => set((state) => ({
        windows: state.windows.filter((w) => w.id !== id),
        activeWindowId: state.activeWindowId === id ? null : state.activeWindowId
    })),

    focusWindow: (id) => set((state) => ({
        activeWindowId: id,
        zIndexCounter: state.zIndexCounter + 1,
        windows: state.windows.map((w) => w.id === id ? { ...w, zIndex: state.zIndexCounter + 1, isMinimized: false } : w)
    })),

    minimizeWindow: (id) => set((state) => ({
        windows: state.windows.map((w) => w.id === id ? { ...w, isMinimized: true } : w),
        activeWindowId: null
    })),

    toggleMaximizeWindow: (id) => set((state) => ({
        windows: state.windows.map((w) => w.id === id ? { ...w, isMaximized: !w.isMaximized } : w)
    })),

    updateWindowPosition: (id, position) => set((state) => ({
        windows: state.windows.map((w) => w.id === id ? { ...w, position } : w)
    })),

    updateWindowSize: (id, size) => set((state) => ({
        windows: state.windows.map((w) => w.id === id ? { ...w, size } : w)
    }))
}))
