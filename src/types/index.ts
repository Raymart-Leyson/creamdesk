export type Workspace = {
    id: string
    user_id: string
    name: string
    created_at: string
}

export type Note = {
    id: string
    user_id: string
    workspace_id: string | null
    title: string
    content: string // JSON or HTML
    created_at: string
    updated_at: string | null
}

export type Task = {
    id: string
    user_id: string
    workspace_id: string | null
    title: string
    due_date: string | null
    status: 'open' | 'done'
    created_at: string
}

export type PdfUpload = {
    id: string
    user_id: string
    workspace_id: string | null
    file_path: string
    original_name: string
    created_at: string
}

export type Flashcard = {
    id: string
    user_id: string
    workspace_id: string | null
    question: string
    answer: string
    created_at: string
}

export type GoogleItem = {
    id: string
    kind: 'drive#file' | 'calendar#event'
    name: string
    mimeType?: string
    webViewLink?: string
    iconLink?: string
    // Calendar specific
    summary?: string
    start?: { dateTime?: string; date?: string }
    end?: { dateTime?: string; date?: string }
}
