"use client"
import DesktopIcon from './DesktopIcon'
import { useDesktopStore, AppId } from '@/store/useStore'
import { Folder, PenTool, CheckSquare, HardDrive, Calendar, Settings, FileText, GraduationCap } from 'lucide-react'

export default function IconsNetwork() {
    const { openWindow } = useDesktopStore()

    const apps = [
        { id: 'notes' as AppId, label: 'Notes', icon: PenTool },
        { id: 'tasks' as AppId, label: 'Tasks', icon: CheckSquare },
        { id: 'drive' as AppId, label: 'Drive', icon: HardDrive },
        { id: 'calendar' as AppId, label: 'Calendar', icon: Calendar },
        { id: 'docs' as AppId, label: 'Docs', icon: FileText },

        { id: 'study' as AppId, label: 'Study Companion', icon: GraduationCap },
    ]

    return (
        <div className="absolute inset-0 flex flex-row flex-wrap content-start items-start p-6 gap-2 pointer-events-none">
            <div className="pointer-events-auto flex flex-row flex-wrap w-full gap-4">
                {apps.map((app) => (
                    <DesktopIcon
                        key={app.id}
                        icon={app.icon}
                        label={app.label}
                        onClick={() => openWindow(app.id)}
                    />
                ))}
            </div>
        </div>
    )
}
