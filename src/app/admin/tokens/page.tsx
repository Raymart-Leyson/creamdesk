"use client"

import { useState } from 'react'
import { CreamButton, CreamCard, CreamInput } from '@/components/ui/CreamComponents'
import { addTokens } from '@/actions/token-actions'
import { CheckCircle2, AlertCircle, Coins } from 'lucide-react'

export default function AdminTokenPage() {
    const [email, setEmail] = useState('')
    const [amount, setAmount] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

    const handleAddTokens = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            const tokenAmount = parseInt(amount)
            if (isNaN(tokenAmount) || tokenAmount <= 0) {
                throw new Error('Please enter a valid token amount')
            }

            const result = await addTokens(email, tokenAmount)

            if (result.success) {
                setMessage({ type: 'success', text: `Successfully added ${tokenAmount} tokens to ${email}` })
                setEmail('')
                setAmount('')
            } else {
                throw new Error(result.error || 'Failed to add tokens')
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[var(--bg-cream)] p-6 flex items-center justify-center">
            <CreamCard className="w-full max-w-md">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-xl border-2 border-[var(--accent-espresso)] flex items-center justify-center shadow-[2px_2px_0px_var(--accent-espresso)]">
                        <Coins size={24} className="text-[var(--accent-espresso)]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-[var(--accent-espresso)]">Admin: Add Tokens</h1>
                        <p className="text-sm text-[var(--accent-espresso)]/60">Manually add tokens to user accounts</p>
                    </div>
                </div>

                <form onSubmit={handleAddTokens} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold mb-1 ml-1 text-[var(--accent-espresso)]">
                            User Email
                        </label>
                        <CreamInput
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold mb-1 ml-1 text-[var(--accent-espresso)]">
                            Token Amount
                        </label>
                        <CreamInput
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="100"
                            min="1"
                            required
                        />
                    </div>

                    {message && (
                        <div className={`p-3 rounded-xl border-2 flex items-start gap-2 ${message.type === 'success'
                            ? 'bg-green-50 border-green-500 text-green-700'
                            : 'bg-red-50 border-red-500 text-red-700'
                            }`}>
                            {message.type === 'success' ? (
                                <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                            )}
                            <span className="text-sm font-bold">{message.text}</span>
                        </div>
                    )}

                    <CreamButton
                        type="submit"
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? 'Adding Tokens...' : 'Add Tokens'}
                    </CreamButton>
                </form>

                <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl">
                    <h3 className="font-bold text-[var(--accent-espresso)] mb-2 text-sm">📋 Quick Reference (Volume Discounts)</h3>
                    <div className="text-xs text-[var(--accent-espresso)]/80 space-y-1">
                        <div>• Starter Pack: 100 tokens (₱200) - ₱2.00/token</div>
                        <div>• Pro Pack: 250 tokens (₱450) - ₱1.80/token <span className="text-green-600 font-bold">(10% OFF)</span></div>
                        <div>• Premium Pack: 500 tokens (₱850) - ₱1.70/token <span className="text-green-600 font-bold">(15% OFF)</span></div>
                        <div>• Ultimate Pack: 1000 tokens (₱1500) - ₱1.50/token <span className="text-green-600 font-bold">(25% OFF)</span></div>
                    </div>
                </div>
            </CreamCard>
        </div>
    )
}
