"use client"
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Task } from '@/types'
import { CreamButton, CreamInput } from '@/components/ui/CreamComponents'
import { CheckSquare, Trash2, Calendar as CalendarIcon, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function TasksApp({ windowId, workspaceId }: { windowId: string, workspaceId?: string }) {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const [newTaskTitle, setNewTaskTitle] = useState('')

    const fetchTasks = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        let query = supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        if (workspaceId) {
            query = query.eq('workspace_id', workspaceId)
        }

        const { data } = await query
        if (data) setTasks(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchTasks()
    }, [workspaceId])

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newTaskTitle.trim()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase.from('tasks').insert({
            user_id: user.id,
            workspace_id: workspaceId || null,
            title: newTaskTitle,
            status: 'open'
        }).select().single()

        if (data) {
            setTasks([data, ...tasks])
            setNewTaskTitle('')
        }
    }

    const toggleStatus = async (task: Task) => {
        const newStatus = task.status === 'open' ? 'done' : 'open'
        // Optimistic
        setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
        await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
    }

    const deleteTask = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Delete task?')) return
        await supabase.from('tasks').delete().eq('id', id)
        setTasks(tasks.filter(t => t.id !== id))
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-cream)] p-4">
            <div className="flex items-center gap-2 mb-4">
                {workspaceId && <ArrowLeft className="text-[var(--accent-espresso)] opacity-50" />}
                <h2 className="text-xl font-bold flex-1">{workspaceId ? 'Project Tasks' : 'My Tasks'}</h2>
            </div>

            <form onSubmit={handleCreate} className="flex gap-2 mb-4">
                <CreamInput
                    placeholder="New Task..."
                    value={newTaskTitle}
                    onChange={e => setNewTaskTitle(e.target.value)}
                />
                <CreamButton type="submit" variant="secondary" className="px-4 text-xl font-bold">+</CreamButton>
            </form>

            <div className="flex-1 overflow-auto bg-white/40 rounded-xl p-2 border-2 border-[var(--accent-espresso)] custom-scrollbar">
                {loading ? (
                    <div className="text-center opacity-50 py-4">Loading...</div>
                ) : tasks.length === 0 ? (
                    <div className="text-center opacity-50 py-10">No tasks yet.</div>
                ) : (
                    tasks.map(task => (
                        <div
                            key={task.id}
                            onClick={() => toggleStatus(task)}
                            className={cn(
                                "group flex items-center justify-between p-3 mb-2 rounded-lg border-2 cursor-pointer transition-all hover:translate-x-1",
                                task.status === 'done'
                                    ? "bg-[var(--accent-espresso)]/10 border-transparent opacity-60 decoration-slice"
                                    : "bg-white border-[var(--accent-espresso)] shadow-[2px_2px_0px_var(--accent-espresso)]"
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-5 h-5 rounded border-2 border-[var(--accent-espresso)] flex items-center justify-center transition-colors",
                                    task.status === 'done' ? "bg-[var(--accent-espresso)]" : "bg-white"
                                )}>
                                    {task.status === 'done' && <CheckSquare size={14} className="text-white" />}
                                </div>
                                <span className={cn("font-bold text-sm", task.status === 'done' && "line-through")}>{task.title}</span>
                            </div>

                            <button
                                onClick={(e) => deleteTask(task.id, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity"
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
