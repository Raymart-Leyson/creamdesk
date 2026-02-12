"use client"
import { useDesktopStore } from '@/store/useStore'
import WindowContainer from './WindowContainer'

export default function WindowManager() {
    const { windows } = useDesktopStore()
    return (
        <>
            {windows.map((w) => (
                <WindowContainer key={w.id} window={w} />
            ))}
        </>
    )
}
