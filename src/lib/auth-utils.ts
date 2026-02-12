import { supabaseAdmin } from './supabase-admin'

export async function getUserFromHeader(request: Request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return null
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return null
    return user
}
