import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // Ensure this is set securely

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey || 'placeholder', {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})
