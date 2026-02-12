'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getUserTokens(userId: string): Promise<number> {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_tokens')
            .select('tokens')
            .eq('user_id', userId)
            .single()

        if (error) {
            // If no record exists, create one with 40 tokens (Free Tier)
            if (error.code === 'PGRST116') {
                const { data: newData, error: insertError } = await supabaseAdmin
                    .from('user_tokens')
                    .insert({ user_id: userId, tokens: 40 })
                    .select('tokens')
                    .single()

                if (insertError) throw insertError
                return newData?.tokens || 40
            }
            throw error
        }

        return data?.tokens || 0
    } catch (error) {
        console.error('Error fetching tokens:', error)
        return 0
    }
}

export async function deductTokens(userId: string, amount: number): Promise<{ success: boolean; remainingTokens: number; error?: string }> {
    try {
        // Get current tokens
        const currentTokens = await getUserTokens(userId)

        if (currentTokens < amount) {
            return {
                success: false,
                remainingTokens: currentTokens,
                error: `Insufficient tokens. You need ${amount} tokens but only have ${currentTokens}.`
            }
        }

        // Deduct tokens
        const { data, error } = await supabaseAdmin
            .from('user_tokens')
            .update({ tokens: currentTokens - amount, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .select('tokens')
            .single()

        if (error) throw error

        return {
            success: true,
            remainingTokens: data?.tokens || 0
        }
    } catch (error: any) {
        console.error('Error deducting tokens:', error)
        return {
            success: false,
            remainingTokens: 0,
            error: error.message || 'Failed to deduct tokens'
        }
    }
}

export async function addTokens(emailOrUserId: string, amount: number): Promise<{ success: boolean; newTotal?: number; error?: string }> {
    try {
        let userId = emailOrUserId

        // If it looks like an email, look up the user ID
        if (emailOrUserId.includes('@')) {
            const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers()

            if (userError) throw userError

            const user = userData.users.find(u => u.email === emailOrUserId)

            if (!user) {
                return {
                    success: false,
                    error: `No user found with email: ${emailOrUserId}`
                }
            }

            userId = user.id
        }

        const currentTokens = await getUserTokens(userId)

        const { data, error } = await supabaseAdmin
            .from('user_tokens')
            .update({ tokens: currentTokens + amount, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .select('tokens')
            .single()

        if (error) throw error

        return {
            success: true,
            newTotal: data?.tokens || 0
        }
    } catch (error: any) {
        console.error('Error adding tokens:', error)
        return {
            success: false,
            error: error.message || 'Failed to add tokens'
        }
    }
}
