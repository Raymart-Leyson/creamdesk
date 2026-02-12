"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Workspace } from '@/types'
import { CreamButton, CreamInput } from '@/components/ui/CreamComponents'
import { Folder, Trash2, ArrowLeft, MoreVertical, FileText, CheckSquare } from 'lucide-react'
import { useDesktopStore } from '@/store/useStore'

export default function WorkspacesApp({ windowId }: { windowId: string }) {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([])
    const [loading, setLoading] = useState(true)
    const [newWorkspaceName, setNewWorkspaceName] = useState('')
    const [isCreating, setIsCreating] = useState(false)
    const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null)
    const { openWindow } = useDesktopStore()

    const fetchWorkspaces = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('workspaces')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

        if (data) setWorkspaces(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchWorkspaces()
    }, [])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newWorkspaceName.trim()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { error } = await supabase.from('workspaces').insert({
            user_id: user.id,
            name: newWorkspaceName
        })

        if (!error) {
            setNewWorkspaceName('')
            setIsCreating(false)
            fetchWorkspaces()
        }
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Delete workspace? This will delete all notes and tasks inside it.')) return
        await supabase.from('workspaces').delete().eq('id', id)
        if (activeWorkspace?.id === id) setActiveWorkspace(null)
        fetchWorkspaces()
    }

    if (activeWorkspace) {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 p-4 border-b-2 border-[var(--accent-espresso)] bg-white/50 sticky top-0 backdrop-blur-sm z-10 shrink-0">
                    <button onClick={() => setActiveWorkspace(null)} className="p-2 hover:bg-[var(--accent-peach)] rounded-lg transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]">
                        <ArrowLeft className="text-[var(--accent-espresso)]" />
                    </button>
                    <h2 className="text-xl font-bold flex-1 truncate">{activeWorkspace.name}</h2>
                    <button className="p-2 opacity-50 hover:opacity-100">
                        <MoreVertical size={20} className="text-[var(--accent-espresso)]" />
                    </button>
                </div>

                <div className="p-4 flex-1 overflow-auto custom-scrollbar">
                    <div className="grid grid-cols-1 gap-4">
                        {/* Notes Card */}
                        <div
                            onClick={() => openWindow('notes', { workspaceId: activeWorkspace.id })}
                            className="bg-[var(--bg-cream)] border-2 border-[var(--accent-espresso)] rounded-xl p-4 shadow-[4px_4px_0px_var(--accent-espresso)] hover:scale-[1.02] hover:shadow-[6px_6px_0px_var(--accent-espresso)] transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-center border-b-2 border-[var(--accent-espresso)]/20 pb-2 mb-2">
                                <h3 className="font-bold flex items-center gap-2">
                                    <div className="p-1 bg-yellow-200 rounded border border-[var(--accent-espresso)]"><FileText size={18} /></div>
                                    Notes
                                </h3>
                                <span className="text-xs font-bold opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">Open App &rarr;</span>
                            </div>
                            <div className="text-sm opacity-60 italic">Click to view notes...</div>
                        </div>

                        {/* Tasks Card */}
                        <div
                            onClick={() => openWindow('tasks', { workspaceId: activeWorkspace.id })}
                            className="bg-[var(--bg-cream)] border-2 border-[var(--accent-espresso)] rounded-xl p-4 shadow-[4px_4px_0px_var(--accent-espresso)] hover:scale-[1.02] hover:shadow-[6px_6px_0px_var(--accent-espresso)] transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-center border-b-2 border-[var(--accent-espresso)]/20 pb-2 mb-2">
                                <h3 className="font-bold flex items-center gap-2">
                                    <div className="p-1 bg-blue-200 rounded border border-[var(--accent-espresso)]"><CheckSquare size={18} /></div>
                                    Tasks
                                </h3>
                                <span className="text-xs font-bold opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">Open App &rarr;</span>
                            </div>
                            <div className="text-sm opacity-60 italic">Click to view tasks...</div>
                        </div>

                        {/* PDF Card */}
                        <div
                            onClick={() => openWindow('pdf', { workspaceId: activeWorkspace.id })}
                            className="bg-[var(--bg-cream)] border-2 border-[var(--accent-espresso)] rounded-xl p-4 shadow-[4px_4px_0px_var(--accent-espresso)] hover:scale-[1.02] hover:shadow-[6px_6px_0px_var(--accent-espresso)] transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-center border-b-2 border-[var(--accent-espresso)]/20 pb-2 mb-2">
                                <h3 className="font-bold flex items-center gap-2">
                                    <div className="p-1 bg-red-200 rounded border border-[var(--accent-espresso)]">PDF</div>
                                    Upload & Process
                                </h3>
                                <span className="text-xs font-bold opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all">Open App &rarr;</span>
                            </div>
                            <div className="text-sm opacity-60 italic">Upload PDF to generate summary/tasks...</div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="p-4 flex flex-col h-full gap-4">
            <div className="flex justify-between items-center shrink-0">
                <h2 className="text-xl font-bold">My Projects</h2>
                <CreamButton onClick={() => setIsCreating(!isCreating)} variant={isCreating ? 'secondary' : 'primary'} className="py-1 px-3 text-xs h-8">
                    {isCreating ? 'Cancel' : 'New +'}
                </CreamButton>
            </div>

            {isCreating && (
                <form onSubmit={handleCreate} className="flex gap-2 shrink-0 animate-in slide-in-from-top-2 fade-in duration-200">
                    <CreamInput
                        placeholder="Project Name..."
                        value={newWorkspaceName}
                        onChange={e => setNewWorkspaceName(e.target.value)}
                        autoFocus
                        className="py-2"
                    />
                    <CreamButton type="submit" className="py-2 px-4 h-full">Create</CreamButton>
                </form>
            )}

            <div className="flex-1 overflow-auto grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 content-start custom-scrollbar pr-1 pb-2">
                {loading ? (
                    <div className="col-span-2 text-center opacity-50 py-10">Loading...</div>
                ) : workspaces.length === 0 ? (
                    <div className="col-span-full text-center opacity-50 py-10 border-2 border-dashed border-[var(--accent-espresso)] rounded-xl bg-white/30 flex flex-col items-center justify-center gap-2">
                        <div className="bg-white/50 p-4 rounded-full border-2 border-[var(--accent-espresso)]"><Folder size={32} className="opacity-20" /></div>
                        <p>No workspaces yet.</p>
                        <p className="text-xs">Create one to get started.</p>
                    </div>
                ) : (
                    workspaces.map(w => (
                        <div
                            key={w.id}
                            onClick={() => setActiveWorkspace(w)}
                            className="bg-white border-2 border-[var(--accent-espresso)] aspect-square rounded-xl p-3 flex flex-col items-center justify-center gap-2 shadow-[4px_4px_0px_var(--accent-espresso)] hover:shadow-[6px_6px_0px_var(--accent-espresso)] hover:-translate-y-1 transition-all cursor-pointer group relative"
                        >
                            <Folder size={40} className="text-[var(--accent-secondary)] fill-[var(--accent-secondary)]/20" strokeWidth={1.5} />
                            <span className="font-bold text-center text-sm leading-tight text-[var(--accent-espresso)] px-2 line-clamp-2">{w.name}</span>
                            <button
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:text-red-600 text-[var(--accent-espresso)]/50 transition-all p-1 hover:bg-red-100 rounded-md"
                                onClick={(e) => handleDelete(w.id, e)}
                                title="Delete Workspace"
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
