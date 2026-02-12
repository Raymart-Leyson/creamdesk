import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserFromHeader } from '@/lib/auth-utils'

export async function GET(request: Request) {
    const user = await getUserFromHeader(request)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: connection } = await supabaseAdmin
        .from('google_connections')
        .select('*')
        .eq('user_id', user.id)
        .single()

    if (!connection) {
        return NextResponse.json({ error: 'Not Connected' }, { status: 404 })
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
    )

    oauth2Client.setCredentials({
        access_token: connection.access_token,
        refresh_token: connection.refresh_token
    })

    // Handle token refresh persistence
    oauth2Client.on('tokens', async (tokens) => {
        if (tokens.access_token) {
            await supabaseAdmin.from('google_connections').update({
                access_token: tokens.access_token,
                expiry: new Date(tokens.expiry_date || Date.now() + 3600 * 1000).toISOString(),
                updated_at: new Date().toISOString()
            }).eq('user_id', user.id)
        }
    })

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

    try {
        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: (new Date()).toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        })

        return NextResponse.json({ events: res.data.items })
    } catch (error: any) {
        console.error('Calendar API Error:', error)
        if (error.code === 401) {
            return NextResponse.json({ error: 'Token Expired' }, { status: 401 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
