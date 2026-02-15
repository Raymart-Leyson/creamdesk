"use client"
import { useEffect, useState } from 'react'
import { format, isToday, isSameDay, formatDistanceToNow } from 'date-fns'
import Link from 'next/link'
import { Bell, Calendar, Clock, MapPin, X, Coins, Plus, Settings, Flame, Crown } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { getUserTokens, addTokens, getTokenDetails } from '@/actions/token-actions'
import { updateStreak, getStreak } from '@/actions/streak-actions'
import { useDesktopStore } from '@/store/useStore'

interface AppEvent {
    id: string
    title: string
    start_time: string
    end_time: string
    description?: string
    location?: string
}

export default function MenuBar() {
    const [time, setTime] = useState(new Date())
    const [events, setEvents] = useState<AppEvent[]>([])
    const [showNotifications, setShowNotifications] = useState(false)
    const [tokens, setTokens] = useState<number>(0)
    const [tokenExpiry, setTokenExpiry] = useState<string | null>(null)
    const [showTokenDetails, setShowTokenDetails] = useState(false)

    const [currentStreak, setCurrentStreak] = useState(0)
    const [longestStreak, setLongestStreak] = useState(0)
    const [showStreakDetail, setShowStreakDetail] = useState(false)
    const { openWindow } = useDesktopStore()



    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        fetchTodayEvents()
        fetchTokens()
        initializeStreak()
        // Refresh events every 5 minutes, tokens every minute
        const eventsInterval = setInterval(fetchTodayEvents, 5 * 60 * 1000)
        const tokensInterval = setInterval(fetchTokens, 60 * 1000)
        return () => {
            clearInterval(eventsInterval)
            clearInterval(tokensInterval)
        }
    }, [])

    const fetchTodayEvents = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data, error } = await supabase
                .from('events')
                .select('*')
                .eq('user_id', user.id)
                .order('start_time', { ascending: true })

            if (error) throw error

            // Filter for today's events
            const todayEvents = (data || []).filter(evt =>
                isToday(new Date(evt.start_time))
            )
            setEvents(todayEvents)
        } catch (e) {
            console.error('Failed to fetch events:', e)
        }
    }

    const fetchTokens = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { tokens: tokenCount, expiresAt } = await getTokenDetails(user.id)
            setTokens(tokenCount)
            setTokenExpiry(expiresAt)
        } catch (e) {
            console.error('Failed to fetch tokens:', e)
        }
    }

    const initializeStreak = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Update streak for today's login
            const updateResult = await updateStreak(user.id)

            if (updateResult.success && updateResult.data) {
                setCurrentStreak(updateResult.data.current_streak)
                setLongestStreak(updateResult.data.longest_streak)
            }
        } catch (e) {
            console.error('Failed to initialize streak:', e)
        }
    }

    const todayEventCount = events.length
    const upcomingEvents = events.filter(evt => new Date(evt.start_time) > new Date())


    return (
        <div className="h-9 w-full bg-[var(--bg-surface)] border-b-2 border-[var(--accent-espresso)] flex items-center justify-between px-4 select-none z-50 shadow-sm sticky top-0">
            {/* Left: Branding */}
            <div className="flex items-center gap-6">
                <span className="font-black text-[var(--accent-espresso)] text-lg tracking-tighter cursor-pointer hover:scale-105 transition-transform">CreamDesk</span>
            </div>

            {/* Right: Utilities */}
            <div className="flex items-center gap-3 text-xs font-bold text-[var(--accent-espresso)]">
                {/* Token Info */}
                <div className="relative flex items-center gap-3">
                    {/* Token Display */}
                    <button
                        onClick={() => setShowTokenDetails(!showTokenDetails)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 border-2 border-yellow-600 rounded-lg shadow-sm hover:bg-yellow-100 transition-colors"
                    >
                        <Coins size={14} className="text-yellow-700" />
                        <span className="font-bold text-yellow-700 text-sm">{tokens}</span>
                        <span className="text-yellow-600/50 text-xs">tokens</span>
                    </button>

                    {/* Token Details Dropdown */}
                    {showTokenDetails && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowTokenDetails(false)} />
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white border-2 border-[var(--accent-espresso)] rounded-xl shadow-[4px_4px_0px_var(--accent-espresso)] z-50 overflow-hidden text-left">
                                <div className="p-3 bg-yellow-50 border-b-2 border-yellow-600/20 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Coins size={16} className="text-yellow-700" />
                                        <span className="font-bold text-[var(--accent-espresso)]">Token Status</span>
                                    </div>
                                    <button onClick={() => setShowTokenDetails(false)}>
                                        <X size={14} />
                                    </button>
                                </div>
                                <div className="p-4 space-y-3">
                                    {tokenExpiry ? (
                                        <>
                                            <div className="bg-orange-50 p-2 rounded border border-orange-200">
                                                <div className="text-[10px] uppercase font-bold text-orange-600 mb-1">Expires In</div>
                                                <div className="font-black text-lg text-orange-700">
                                                    {formatDistanceToNow(new Date(tokenExpiry), { addSuffix: true })}
                                                </div>
                                                <div className="text-xs text-orange-600/80 mt-1">
                                                    {format(new Date(tokenExpiry), "MMMM d, yyyy 'at' h:mm a")}
                                                </div>
                                            </div>
                                            <div className="text-xs text-[var(--accent-espresso)]/80 leading-relaxed">
                                                <p className="font-bold mb-1">What happens when it expires?</p>
                                                <ul className="list-disc pl-4 space-y-1">
                                                    <li>If you have <strong>more than 100</strong> tokens, your balance will reset to <strong>100</strong>.</li>
                                                    <li>If you have <strong>100 or less</strong>, you keep all your tokens!</li>
                                                </ul>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-2">
                                            <div className="text-sm font-bold text-[var(--accent-espresso)]">No Expiration Date</div>
                                            <p className="text-xs text-[var(--accent-espresso)]/60 mt-1">Your tokens are safe forever!</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Buy Tokens Button */}
                    <Link href="/shop">
                        <button className="px-3 py-1.5 bg-gradient-to-r from-yellow-400 to-orange-400 text-[var(--accent-espresso)] rounded-lg border-2 border-[var(--accent-espresso)] shadow-[2px_2px_0px_var(--accent-espresso)] hover:shadow-[3px_3px_0px_var(--accent-espresso)] hover:-translate-y-0.5 transition-all font-bold text-xs flex items-center gap-1.5">
                            <Coins size={14} />
                            Buy Tokens
                        </button>
                    </Link>
                </div>

                {/* Divider */}
                <div className="h-5 w-px bg-[var(--accent-espresso)]/20"></div>
                {/* Notification Bell */}
                <div className="relative">
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative p-1.5 hover:bg-[var(--accent-espresso)]/10 rounded-lg transition-all"
                        title="Today's Events"
                    >
                        <Bell size={16} />
                        {todayEventCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border border-white">
                                {todayEventCount}
                            </span>
                        )}
                    </button>

                    {/* Notification Dropdown */}
                    {showNotifications && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowNotifications(false)}
                            />

                            {/* Dropdown */}
                            <div className="absolute right-0 top-full mt-2 w-80 bg-white border-2 border-[var(--accent-espresso)] rounded-xl shadow-[4px_4px_0px_var(--accent-espresso)] z-50 overflow-hidden">
                                {/* Header */}
                                <div className="p-3 bg-[var(--cream-highlight)] border-b-2 border-[var(--accent-espresso)] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={16} />
                                        <span className="font-bold">Today's Schedule</span>
                                    </div>
                                    <button
                                        onClick={() => setShowNotifications(false)}
                                        className="hover:bg-[var(--accent-espresso)]/10 p-1 rounded transition-all"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                {/* Events List */}
                                <div className="max-h-96 overflow-y-auto">
                                    {events.length === 0 ? (
                                        <div className="p-6 text-center opacity-50">
                                            <Calendar size={32} className="mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">No events scheduled for today</p>
                                            <p className="text-xs mt-1 opacity-60">Enjoy your free day! 🎉</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-[var(--accent-espresso)]/10">
                                            {events.map(evt => {
                                                const isPast = new Date(evt.end_time) < new Date()
                                                const isUpcoming = new Date(evt.start_time) > new Date()

                                                return (
                                                    <div
                                                        key={evt.id}
                                                        className={`p-3 hover:bg-[var(--bg-cream)] transition-colors ${isPast ? 'opacity-50' : ''}`}
                                                    >
                                                        <div className="flex items-start gap-2">
                                                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isPast ? 'bg-gray-400' :
                                                                isUpcoming ? 'bg-blue-500' :
                                                                    'bg-green-500 animate-pulse'
                                                                }`} />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-bold text-sm truncate">
                                                                    {evt.title}
                                                                </div>
                                                                <div className="flex items-center gap-1 text-xs opacity-70 mt-1">
                                                                    <Clock size={10} />
                                                                    <span>
                                                                        {format(new Date(evt.start_time), 'h:mm a')} - {format(new Date(evt.end_time), 'h:mm a')}
                                                                    </span>
                                                                </div>
                                                                {evt.location && (
                                                                    <div className="flex items-center gap-1 text-xs opacity-60 mt-0.5">
                                                                        <MapPin size={10} />
                                                                        <span className="truncate">{evt.location}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                {events.length > 0 && (
                                    <div className="p-2 bg-[var(--bg-surface)] border-t border-[var(--accent-espresso)]/20 text-center text-xs opacity-60">
                                        {upcomingEvents.length > 0 ? (
                                            <span>{upcomingEvents.length} upcoming event{upcomingEvents.length !== 1 ? 's' : ''}</span>
                                        ) : (
                                            <span>All events completed ✓</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Divider */}
                <div className="h-5 w-px bg-[var(--accent-espresso)]/20"></div>

                {/* Streak Display */}
                <div className="relative">
                    <button
                        onClick={() => setShowStreakDetail(!showStreakDetail)}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-500 rounded-lg shadow-[2px_2px_0px_rgba(234,88,12,0.3)] hover:scale-105 transition-transform cursor-pointer hover:from-orange-100 hover:to-red-100 active:scale-95"
                        title="Daily Login Streak"
                    >
                        <Flame size={14} className="text-orange-500" fill={currentStreak > 0 ? "#f97316" : "none"} />
                        <span className="font-bold text-orange-600 text-sm">{currentStreak}</span>
                        {currentStreak > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                        )}
                    </button>

                    {/* Streak Detail Dropdown */}
                    {showStreakDetail && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowStreakDetail(false)}
                            />

                            {/* Dropdown */}
                            <div className="absolute right-0 top-full mt-2 w-64 bg-white border-2 border-[var(--accent-espresso)] rounded-xl shadow-[4px_4px_0px_var(--accent-espresso)] z-50 overflow-hidden">
                                {/* Header */}
                                <div className="p-3 bg-gradient-to-r from-orange-50 to-red-50 border-b-2 border-[var(--accent-espresso)] flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Flame size={16} className="text-orange-500" fill="#f97316" />
                                        <span className="font-bold">Login Streak</span>
                                    </div>
                                    <button
                                        onClick={() => setShowStreakDetail(false)}
                                        className="hover:bg-[var(--accent-espresso)]/10 p-1 rounded transition-all"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>

                                {/* Stats */}
                                <div className="p-4 space-y-3">
                                    <div className="bg-[var(--bg-cream)] rounded-lg p-3 border-2 border-orange-200">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Current Streak</div>
                                        <div className="flex items-center gap-2">
                                            <Flame size={24} className="text-orange-500" fill={currentStreak > 0 ? "#f97316" : "none"} />
                                            <span className="text-3xl font-black text-orange-600">{currentStreak}</span>
                                            <span className="text-sm font-bold text-gray-500">days</span>
                                        </div>
                                    </div>

                                    <div className="bg-[var(--bg-cream)] rounded-lg p-3 border-2 border-yellow-200">
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Longest Streak</div>
                                        <div className="flex items-center gap-2">
                                            <Crown size={20} className="text-yellow-600" fill="#ca8a04" />
                                            <span className="text-2xl font-black text-yellow-600">{longestStreak}</span>
                                            <span className="text-sm font-bold text-gray-500">days</span>
                                        </div>
                                    </div>

                                    {currentStreak > 0 && (
                                        <div className="text-xs text-center text-gray-500 font-medium pt-2 border-t border-gray-200">
                                            🎉 Keep it up! Come back tomorrow to continue your streak!
                                        </div>
                                    )}

                                    {currentStreak === 0 && (
                                        <div className="text-xs text-center text-gray-500 font-medium pt-2 border-t border-gray-200">
                                            Start your streak by logging in daily!
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Divider */}
                <div className="h-5 w-px bg-[var(--accent-espresso)]/20"></div>

                {/* Settings Icon */}
                <button
                    onClick={() => openWindow('settings')}
                    className="p-1.5 hover:bg-[var(--accent-espresso)]/10 rounded-lg transition-all"
                    title="Settings"
                >
                    <Settings size={16} />
                </button>

                {/* Divider */}
                <div className="h-5 w-px bg-[var(--accent-espresso)]/20"></div>

                {/* Time */}
                <span className="uppercase tracking-wide text-[10px] font-bold">{format(time, 'EEE d MMM h:mm a')}</span>

            </div>

        </div>
    )
}
