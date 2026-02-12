"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { CreamCard, CreamButton, CreamInput } from '@/components/ui/CreamComponents'

export default function LoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) throw error

            router.push('/desktop')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-cream)] p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
                <CreamCard className="w-[700px] max-w-lg bg-[var(--bg-surface)]">
                    <h1 className="text-3xl font-bold mb-2 text-center text-[var(--accent-espresso)]">CreamDesk</h1>
                    <p className="text-center text-[var(--accent-espresso)] mb-6 opacity-80">Log in to your desktop</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold mb-1 ml-1 text-[var(--accent-espresso)]">Email</label>
                            <CreamInput
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-1 ml-1 text-[var(--accent-espresso)]">Password</label>
                            <CreamInput
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-100 border-2 border-red-400 text-red-700 rounded-xl text-sm font-bold">
                                {error}
                            </div>
                        )}

                        <CreamButton
                            variant="secondary"
                            type="submit"
                            className="w-full justify-center mt-4"
                            disabled={loading}
                            onClick={() => { }}
                        >
                            {loading ? 'Opening...' : 'Launch Desktop'}
                        </CreamButton>
                    </form>

                    <div className="mt-6 text-center text-sm font-medium">
                        Don't have an account?{' '}
                        <Link href="/signup" className="text-[var(--accent-peach)] underline decoration-2 hover:text-[var(--accent-espresso)] transition">
                            Sign up
                        </Link>
                    </div>
                </CreamCard>
            </motion.div>
        </div>
    )
}
