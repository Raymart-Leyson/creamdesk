"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Desktop from '@/components/desktop/Desktop'

export default function DesktopPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push('/login')
            } else {
                setLoading(false)
            }
        }
        checkAuth()
    }, [router])

    if (loading) {
        return (
            <div className="h-screen w-screen bg-[var(--bg-cream)] flex items-center justify-center">
                <div className="text-[var(--accent-espresso)] font-bold text-xl animate-pulse">
                    Booting CreamDesk...
                </div>
            </div>
        )
    }

    return <Desktop />
}
