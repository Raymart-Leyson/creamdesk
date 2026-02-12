import NotesApp from './NotesApp'
import TasksApp from './TasksApp'
import DriveApp from './DriveApp'
import CalendarApp from './CalendarApp'
import PdfApp from './PdfApp'
import SettingsApp from './SettingsApp'
import DocsApp from './DocsApp'
import StudyApp from './StudyApp'

import { AppId } from '@/store/useStore'

export const Apps: Record<AppId, any> = {
    notes: NotesApp,
    tasks: TasksApp,
    drive: DriveApp,
    calendar: CalendarApp,
    pdf: PdfApp,
    settings: SettingsApp,
    docs: DocsApp,
    study: StudyApp,
}
