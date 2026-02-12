import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const userId = searchParams.get('state')

    if (!code || !userId) {
        return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/oauth/google/callback`
    )

    try {
        const { tokens } = await oauth2Client.getToken(code)

        // Save tokens securely using Admin client (Service Role)
        const { error } = await supabaseAdmin
            .from('google_connections')
            .upsert({
                user_id: userId,
                provider: 'google',
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token, // Only available on first consent or if forced
                expiry: new Date(tokens.expiry_date || Date.now() + 3600 * 1000).toISOString(),
                scopes: tokens.scope,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })

        if (error) throw error

        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/desktop?connected=true`)
    } catch (error: any) {
        console.error('OAuth Callback Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
