import dynamic from 'next/dynamic'
import NotesApp from './NotesApp'
import TasksApp from './TasksApp'

import CalendarApp from './CalendarApp'
import PdfApp from './PdfApp'
import SettingsApp from './SettingsApp'
// Use dynamic import for DocsApp to avoid SSR issues with pdfjs-dist
const DocsApp = dynamic(() => import('./DocsApp'), { ssr: false })
import StudyApp from './StudyApp'

import { AppId } from '@/store/useStore'

export const Apps: Record<AppId, any> = {
    notes: NotesApp,
    tasks: TasksApp,

    calendar: CalendarApp,
    pdf: PdfApp,
    settings: SettingsApp,
    docs: DocsApp,
    study: StudyApp,
}
