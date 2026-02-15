'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function getUserTokens(userId: string): Promise<number> {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_tokens')
            .select('tokens, expires_at')
            .eq('user_id', userId)
            .single()

        // Check for expiration
        if (data && data.expires_at) {
            const expirationDate = new Date(data.expires_at)
            const now = new Date()

            if (now > expirationDate) {
                // EXPIRED!
                let newTokens = data.tokens

                // Rule: If > 100, reset to 100. If <= 100, keep as is.
                if (data.tokens > 100) {
                    newTokens = 100
                }

                // Update DB: Set new token amount and remove expiration date
                await supabaseAdmin
                    .from('user_tokens')
                    .update({
                        tokens: newTokens,
                        expires_at: null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('user_id', userId)

                return newTokens
            }
        }

        if (error) {
            // If no record exists, create one with 40 tokens (Free Tier)
            if (error.code === 'PGRST116') {
                const { data: newData, error: insertError } = await supabaseAdmin
                    .from('user_tokens')
                    .insert({ user_id: userId, tokens: 20 })
                    .select('tokens')
                    .single()

                if (insertError) throw insertError
                return newData?.tokens || 20
            }
            throw error
        }

        return data?.tokens || 0
    } catch (error) {
        console.error('Error fetching tokens:', error)
        return 0
    }
}

// New function to get full token details including expiration
export async function getTokenDetails(userId: string): Promise<{ tokens: number; expiresAt: string | null }> {
    try {
        const { data, error } = await supabaseAdmin
            .from('user_tokens')
            .select('tokens, expires_at')
            .eq('user_id', userId)
            .single()

        if (error) {
            // If PZRST116 (not found), try creating default and return default
            if (error.code === 'PGRST116') {
                await getUserTokens(userId) // efficient trigger to create if not exists
                return { tokens: 20, expiresAt: null }
            }
            throw error
        }

        // Return existing data (checking for expiry happens in getUserTokens generally, but for display we just show what's in DB or we can replicate logic. 
        // Better to reuse the cleanup logic. I will call getUserTokens first to ensure cleanup, then return the fresh state.
        // Actually getUserTokens returns number. The cleanup happens inside it.
        // So:
        const tokens = await getUserTokens(userId)

        // Now fetch again to get the potentially updated expires_at (if it was cleared)
        const { data: freshData } = await supabaseAdmin
            .from('user_tokens')
            .select('expires_at')
            .eq('user_id', userId)
            .single()

        return {
            tokens,
            expiresAt: freshData?.expires_at || null
        }

    } catch (error) {
        console.error('Error fetching token details:', error)
        return { tokens: 0, expiresAt: null }
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

export async function addTokens(emailOrUserId: string, amount: number, expiryDays?: number): Promise<{ success: boolean; newTotal?: number; error?: string }> {
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

        // Calculate new expiration if days provided
        let updates: any = {
            tokens: currentTokens + amount,
            updated_at: new Date().toISOString()
        }

        if (expiryDays) {
            const expiryDate = new Date()
            expiryDate.setDate(expiryDate.getDate() + expiryDays)
            updates.expires_at = expiryDate.toISOString()
        }

        const { data, error } = await supabaseAdmin
            .from('user_tokens')
            .update(updates)
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
