"use client"

import { useDesktopStore, WindowState } from '@/store/useStore'
import { Apps } from '@/apps'
import { useRef } from 'react'
import Draggable from 'react-draggable'
import { X, Minus, Maximize2, Minimize2 } from 'lucide-react'

export default function WindowContainer({ window }: { window: WindowState }) {
    const { closeWindow, focusWindow, updateWindowPosition, minimizeWindow, toggleMaximizeWindow } = useDesktopStore()
    const nodeRef = useRef(null)

    const Component = Apps[window.appId]

    if (window.isMinimized) return null

    const windowContent = (
        <div
            ref={nodeRef}
            style={{
                zIndex: window.zIndex,
                width: window.isMaximized ? 'calc(100% - 16px)' : window.size.width,
                height: window.isMaximized ? 'calc(100% - 20px)' : window.size.height, // Maximize space
                position: 'absolute',
                top: window.isMaximized ? 0 : undefined,
                left: window.isMaximized ? 0 : undefined,
            }}
            className={`flex flex-col bg-[var(--bg-cream)] border-[3px] border-[var(--accent-espresso)] rounded-xl shadow-[8px_8px_0px_rgba(58,42,32,0.2)] overflow-hidden transition-all duration-300 ${window.isMaximized ? 'm-2' : ''}`}
            onMouseDown={() => focusWindow(window.id)}
        >
            {/* Title Bar */}
            <div className="window-title-bar h-10 bg-[var(--bg-surface)] border-b-2 border-[var(--accent-espresso)] flex items-center px-3 justify-between select-none cursor-grab active:cursor-grabbing shrink-0" onDoubleClick={() => toggleMaximizeWindow(window.id)}>
                <div className="flex gap-2 items-center group/controls">
                    <button
                        className="w-4 h-4 rounded-full border-2 border-[var(--accent-espresso)] bg-red-400 hover:bg-red-500 transition-all flex items-center justify-center group/btn"
                        onClick={(e) => { e.stopPropagation(); closeWindow(window.id); }}
                    >
                        <X size={10} className="text-[var(--accent-espresso)] opacity-0 group-hover/controls:opacity-100 transition-opacity" strokeWidth={3} />
                    </button>
                    <button
                        className="w-4 h-4 rounded-full border-2 border-[var(--accent-espresso)] bg-yellow-400 hover:bg-yellow-500 transition-all flex items-center justify-center group/btn"
                        onClick={(e) => { e.stopPropagation(); minimizeWindow(window.id); }}
                    >
                        <Minus size={10} className="text-[var(--accent-espresso)] opacity-0 group-hover/controls:opacity-100 transition-opacity" strokeWidth={3} />
                    </button>
                    {/* Maximize button removed as requested */}
                </div>
                <span className="font-bold text-xs text-[var(--accent-espresso)] tracking-widest uppercase pointer-events-none absolute left-1/2 -translate-x-1/2">
                    {window.title}
                </span>
                <div className="w-12" /> {/* Spacer */}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden bg-white/40 relative">
                {Component ? <Component {...window.props} windowId={window.id} /> : <div className="p-4 text-red-500">App not found: {window.appId}</div>}
            </div>

            {/* Resize Handle only if not maximized */}
            {!window.isMaximized && (
                <div className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100" />
            )}
        </div>
    )

    if (window.isMaximized) {
        return windowContent
    }

    return (
        <Draggable
            nodeRef={nodeRef}
            handle=".window-title-bar"
            defaultPosition={window.position}
            onStop={(e, data) => updateWindowPosition(window.id, { x: data.x, y: data.y })}
            onMouseDown={() => focusWindow(window.id)}
        >
            {windowContent}
        </Draggable>
    )
}
