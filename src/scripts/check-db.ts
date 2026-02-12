
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing environment variables')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function runMigration() {
    console.log('Applying migration for documents table...')

    // Note: supabase-js doesn't have a direct sql() method for security reasons.
    // However, we can try to use a RPC if one exists, but usually there isn't.
    // The only way to run arbitrary SQL via supabase-js is if there is a postgres function.

    // Since we can't run arbitrary SQL easily, let's try to check if the table exists by a query.
    const { error } = await supabase.from('documents').select('id').limit(1)

    if (error && error.code === 'PGRST116') {
        console.log('Table documents found (or empty).')
    } else if (error && error.code === '42P01') {
        console.log('Table documents does NOT exist. Please run the SQL in migrations folder via Supabase Dashboard.')
    } else {
        console.log('Table status unknown or check successful:', error || 'Success')
    }
}

runMigration()
