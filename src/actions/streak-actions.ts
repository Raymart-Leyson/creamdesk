"use server"

import { supabase } from '@/lib/supabase'

export async function updateStreak(userId: string) {
    try {
        const { data, error } = await supabase.rpc('update_user_streak', {
            p_user_id: userId
        })

        if (error) throw error

        return {
            success: true,
            data: data?.[0] || { current_streak: 0, longest_streak: 0, total_logins: 0 }
        }
    } catch (error) {
        console.error('Error updating streak:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update streak'
        }
    }
}

export async function getStreak(userId: string) {
    try {
        const { data, error } = await supabase
            .from('user_streaks')
            .select('*')
            .eq('user_id', userId)
            .single()

        if (error && error.code !== 'PGRST116') throw error

        return {
            success: true,
            data: data || { current_streak: 0, longest_streak: 0, total_logins: 0 }
        }
    } catch (error) {
        console.error('Error getting streak:', error)
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to get streak'
        }
    }
}
