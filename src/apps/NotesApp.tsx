"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Note } from '@/types'
import { Folder, PenTool, Trash2, ArrowLeft } from 'lucide-react'

export default function NotesApp({ windowId, workspaceId, noteId }: { windowId: string, workspaceId?: string, noteId?: string }) {
    const [notes, setNotes] = useState<Note[]>([])
    const [activeNote, setActiveNote] = useState<Note | null>(null)
    const [loading, setLoading] = useState(true)

    // Fetch Logic
    const fetchNotes = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        let query = supabase.from('notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
        if (workspaceId) {
            query = query.eq('workspace_id', workspaceId)
        }

        const { data } = await query
        if (data) setNotes(data)
        setLoading(false)
    }

    // Initial Fetch & Auto-open logic
    useEffect(() => {
        fetchNotes()
    }, [workspaceId]) // Re-fetch if workspaceId changes

    useEffect(() => {
        if (noteId && notes.length > 0) {
            const found = notes.find(n => n.id === noteId)
            if (found) setActiveNote(found)
        }
    }, [noteId, notes])

    const createNote = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase.from('notes').insert({
            user_id: user.id,
            workspace_id: workspaceId || null,
            title: 'Untitled Note',
            content: ''
        }).select().single()

        if (data) {
            setNotes([data, ...notes])
            setActiveNote(data)
        }
    }

    const updateNote = async (id: string, updates: Partial<Note>) => {
        // Optimistic update
        setNotes(notes.map(n => n.id === id ? { ...n, ...updates } : n))
        setActiveNote(prev => prev?.id === id ? { ...prev, ...updates } : prev)

        // Debounce this in production
        await supabase.from('notes').update(updates).eq('id', id)
    }

    const deleteNote = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Delete note?')) return
        await supabase.from('notes').delete().eq('id', id)
        setNotes(notes.filter(n => n.id !== id))
        if (activeNote?.id === id) setActiveNote(null)
    }

    if (activeNote) {
        return (
            <div className="flex flex-col h-full bg-[var(--bg-cream)]">
                <div className="flex items-center gap-2 p-2 border-b-2 border-[var(--accent-espresso)]">
                    <button onClick={() => setActiveNote(null)} className="p-1 hover:bg-[var(--accent-peach)] rounded pointer-cursor">
                        <ArrowLeft className="text-[var(--accent-espresso)]" />
                    </button>
                    <input
                        className="flex-1 bg-transparent font-bold text-lg focus:outline-none text-[var(--accent-espresso)]"
                        value={activeNote.title}
                        onChange={(e) => updateNote(activeNote.id, { title: e.target.value })}
                        placeholder="Note Title"
                    />
                </div>
                <textarea
                    className="flex-1 resize-none p-4 bg-transparent focus:outline-none text-[var(--accent-espresso)] leading-relaxed font-serif text-lg custom-scrollbar"
                    value={activeNote.content || ''}
                    onChange={(e) => updateNote(activeNote.id, { content: e.target.value })}
                    placeholder="Write something..."
                />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-xl">{workspaceId ? 'Workspace Notes' : 'All My Notes'}</h2>
                <button
                    onClick={createNote}
                    className="bg-[var(--accent-espresso)] text-[var(--bg-cream)] px-3 py-1 rounded-lg font-bold hover:opacity-90 transition-opacity flex items-center gap-2"
                >
                    <PenTool size={14} /> New Note
                </button>
            </div>

            <div className="flex-1 overflow-auto flex flex-col gap-2 custom-scrollbar">
                {loading ? (
                    <div className="text-center opacity-50">Loading notes...</div>
                ) : notes.length === 0 ? (
                    <div className="text-center opacity-50 py-10 border-2 border-dashed border-[var(--accent-espresso)] rounded-xl">
                        No notes found.
                    </div>
                ) : (
                    notes.map(note => (
                        <div
                            key={note.id}
                            onClick={() => setActiveNote(note)}
                            className="bg-white border-2 border-[var(--accent-espresso)] p-3 rounded-xl shadow-[2px_2px_0px_var(--accent-espresso)] hover:shadow-[4px_4px_0px_var(--accent-espresso)] hover:-translate-y-0.5 transition-all cursor-pointer group flex justify-between items-start"
                        >
                            <div className="flex-1 overflow-hidden">
                                <h4 className="font-bold text-[var(--accent-espresso)] truncate">{note.title || 'Untitled'}</h4>
                                <p className="text-xs opacity-60 truncate">{note.content || 'No content'}</p>
                                <span className="text-[10px] opacity-40">{new Date(note.updated_at!).toLocaleDateString()}</span>
                            </div>
                            <button
                                onClick={(e) => deleteNote(note.id, e)}
                                className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-1"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
