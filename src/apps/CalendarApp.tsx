"use client"
import { useEffect, useState } from 'react'
import { CreamButton } from '@/components/ui/CreamComponents'
import { supabase } from '@/lib/supabase'
import { Calendar as CalendarIcon, Trash2, Plus, Clock, MapPin, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek, isSameMonth } from 'date-fns'

interface AppEvent {
    id: string
    title: string
    start_time: string
    end_time: string
    description?: string
    location?: string
    color?: string
}

export default function CalendarApp() {
    const [events, setEvents] = useState<AppEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [isOpen, setIsOpen] = useState(false)
    const [formData, setFormData] = useState({ title: '', start_time: '', end_time: '', location: '', description: '' })
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(null) // For day detail modal

    useEffect(() => {
        fetchEvents()
    }, [])

    const fetchEvents = async () => {
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*')
                .order('start_time', { ascending: true })

            if (error) throw error
            setEvents(data || [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleAddEvent = async () => {
        if (!formData.title || !formData.start_time || !formData.end_time) return
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("No user")

            const { error } = await supabase.from('events').insert({
                user_id: user.id,
                ...formData
            })

            if (error) throw error
            setIsOpen(false)
            fetchEvents()
            setFormData({ title: '', start_time: '', end_time: '', location: '', description: '' })
        } catch (e) {
            console.error(e)
        }
    }

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation()
        if (!confirm("Delete this event?")) return
        try {
            await supabase.from('events').delete().eq('id', id)
            fetchEvents()
        } catch (e) {
            console.error(e)
        }
    }

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1))
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1))
    const goToToday = () => setCurrentDate(new Date())

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const calendarStart = startOfWeek(monthStart)
    const calendarEnd = endOfWeek(monthEnd)

    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    return (
        <div className="flex flex-col h-full bg-[var(--bg-cream)]">
            <div className="p-4 border-b-2 border-[var(--accent-espresso)] flex justify-between items-center bg-[var(--bg-surface)] sticky top-0 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <CalendarIcon size={20} /> My Calendar
                    </h2>
                    <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--accent-espresso)] rounded-lg p-1 shadow-sm">
                        <button onClick={prevMonth} className="p-1 hover:bg-[var(--accent-espresso)]/5 rounded"><ChevronLeft size={16} /></button>
                        <button onClick={goToToday} className="px-2 text-sm font-bold hover:bg-[var(--accent-espresso)]/5 rounded w-32 text-center text-[var(--accent-espresso)]">
                            {format(currentDate, 'MMMM yyyy')}
                        </button>
                        <button onClick={nextMonth} className="p-1 hover:bg-[var(--accent-espresso)]/5 rounded"><ChevronRight size={16} /></button>
                    </div>
                </div>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                    <DialogTrigger asChild>
                        <CreamButton className="py-1 px-3 text-sm flex items-center gap-1">
                            <Plus size={14} /> Event
                        </CreamButton>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Add New Event</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="title" className="text-right">Event</Label>
                                <Input id="title" value={formData.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="start" className="text-right">Start</Label>
                                <Input id="start" type="datetime-local" value={formData.start_time} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, start_time: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="end" className="text-right">End</Label>
                                <Input id="end" type="datetime-local" value={formData.end_time} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, end_time: e.target.value })} className="col-span-3" />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="location" className="text-right">Location</Label>
                                <Input id="location" value={formData.location} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, location: e.target.value })} className="col-span-3" />
                            </div>
                            <Button onClick={handleAddEvent}>Save Event</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Weekday Headers - Outside the Scrollable Area to fix spacing and keep sticky-ish */}
            <div className="grid grid-cols-7 gap-2 px-4 py-2 bg-[var(--bg-cream)] shrink-0 border-b border-[var(--accent-espresso)]/10">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center font-bold text-[var(--accent-espresso)] text-xs opacity-60 uppercase tracking-widest">{day}</div>
                ))}
            </div>

            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div>
                ) : (
                    <div className="grid grid-cols-7 gap-2 auto-rows-fr h-full min-h-[600px]">
                        {calendarDays.map((day, idx) => {
                            const dayEvents = events.filter(evt => isSameDay(new Date(evt.start_time), day))
                            const isCurrentMonth = isSameMonth(day, currentDate)

                            const handleDayClick = () => {
                                setSelectedDate(day)
                            }

                            return (
                                <div
                                    key={day.toISOString()}
                                    onClick={handleDayClick}
                                    className={`
                                        border-2 rounded-xl p-2 flex flex-col gap-1 min-h-[100px] transition-all cursor-pointer hover:border-[var(--accent-peach)]
                                        ${isCurrentMonth ? 'bg-[var(--bg-surface)] border-[var(--accent-espresso)]/20' : 'bg-[var(--accent-espresso)]/5 border-transparent opacity-50'}
                                        ${isToday(day) ? 'bg-[var(--cream-highlight)] border-[var(--accent-espresso)]' : ''}
                                    `}
                                >
                                    <div className="flex justify-between items-start">
                                        <span className={`text-sm font-bold ${isToday(day) ? 'text-[var(--accent-espresso)]' : 'opacity-50'}`}>
                                            {format(day, 'd')}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1">
                                        {dayEvents.map(evt => (
                                            <div
                                                key={evt.id}
                                                onClick={(e) => { e.stopPropagation(); /* Allow editing later? */ }}
                                                className="bg-[var(--accent-espresso)] text-[var(--bg-cream)] text-[10px] p-1.5 rounded-md leading-tight group relative cursor-default hover:scale-[1.02] transition-transform"
                                            >
                                                <div className="font-bold truncate">{evt.title}</div>
                                                <div className="opacity-80 truncate">{format(new Date(evt.start_time), 'h:mm a')}</div>

                                                <button
                                                    onClick={(e) => handleDelete(e, evt.id)}
                                                    className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 hover:text-[var(--accent-peach)] transition-opacity bg-[var(--accent-espresso)] rounded-full"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Day Detail Modal */}
            {selectedDate && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setSelectedDate(null)}
                >
                    <div
                        className="relative bg-white border-4 border-[var(--accent-espresso)] rounded-2xl shadow-[8px_8px_0px_var(--accent-espresso)] max-w-2xl w-full max-h-[80vh] overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b-2 border-[var(--accent-espresso)] bg-[var(--cream-highlight)]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-[var(--accent-espresso)]">
                                        {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                                    </h2>
                                    <p className="text-sm opacity-60 mt-1">
                                        {events.filter(evt => isSameDay(new Date(evt.start_time), selectedDate)).length} event(s)
                                    </p>
                                </div>
                                <button
                                    onClick={() => setSelectedDate(null)}
                                    className="w-10 h-10 rounded-full bg-[var(--accent-espresso)] text-white flex items-center justify-center font-bold hover:scale-110 transition-transform"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Events List */}
                        <div className="p-6 overflow-y-auto max-h-[50vh]">
                            {events.filter(evt => isSameDay(new Date(evt.start_time), selectedDate)).length === 0 ? (
                                <div className="text-center py-12 opacity-40">
                                    <CalendarIcon size={48} className="mx-auto mb-4" />
                                    <p className="font-medium">No events scheduled for this day</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {events
                                        .filter(evt => isSameDay(new Date(evt.start_time), selectedDate))
                                        .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                                        .map(evt => (
                                            <div
                                                key={evt.id}
                                                className="group bg-[var(--bg-cream)] border-2 border-[var(--accent-espresso)] rounded-xl p-4 hover:shadow-[4px_4px_0px_var(--accent-espresso)] transition-all"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-lg text-[var(--accent-espresso)] mb-2">
                                                            {evt.title}
                                                        </h3>
                                                        <div className="space-y-1 text-sm">
                                                            <div className="flex items-center gap-2 opacity-70">
                                                                <Clock size={14} />
                                                                <span>
                                                                    {format(new Date(evt.start_time), 'h:mm a')} - {format(new Date(evt.end_time), 'h:mm a')}
                                                                </span>
                                                            </div>
                                                            {evt.location && (
                                                                <div className="flex items-center gap-2 opacity-70">
                                                                    <MapPin size={14} />
                                                                    <span>{evt.location}</span>
                                                                </div>
                                                            )}
                                                            {evt.description && (
                                                                <p className="mt-2 opacity-60">{evt.description}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDelete(e, evt.id)}
                                                        className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 rounded-lg transition-all text-red-600"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>

                        {/* Footer with Add Event Button */}
                        <div className="p-6 border-t-2 border-[var(--accent-espresso)] bg-[var(--bg-surface)]">
                            <button
                                onClick={() => {
                                    const start = new Date(selectedDate)
                                    start.setHours(9, 0, 0, 0)
                                    const end = new Date(selectedDate)
                                    end.setHours(10, 0, 0, 0)

                                    const formatForInput = (d: Date) => {
                                        const pad = (n: number) => n < 10 ? '0' + n : n
                                        return d.getFullYear() + '-' +
                                            pad(d.getMonth() + 1) + '-' +
                                            pad(d.getDate()) + 'T' +
                                            pad(d.getHours()) + ':' +
                                            pad(d.getMinutes())
                                    }

                                    setFormData({
                                        title: '',
                                        start_time: formatForInput(start),
                                        end_time: formatForInput(end),
                                        location: '',
                                        description: ''
                                    })
                                    setSelectedDate(null)
                                    setIsOpen(true)
                                }}
                                className="w-full flex items-center justify-center gap-2 bg-[var(--cream-highlight)] border-2 border-[var(--accent-espresso)] px-6 py-3 rounded-lg font-bold shadow-[3px_3px_0px_var(--accent-espresso)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_var(--accent-espresso)] active:translate-y-[0px] active:shadow-[0px_0px_0px_var(--accent-espresso)] transition-all"
                            >
                                <Plus size={20} />
                                Add Event to This Day
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
