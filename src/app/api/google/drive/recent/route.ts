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
        refresh_token: connection.refresh_token,
        // expiry_date: new Date(connection.expiry).getTime() // Optional but good for auto-refresh
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

    const drive = google.drive({ version: 'v3', auth: oauth2Client })

    try {
        const res = await drive.files.list({
            pageSize: 10,
            fields: 'files(id, name, mimeType, webViewLink, iconLink, modifiedTime)',
            q: "(mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.google-apps.spreadsheet') and trashed = false",
            orderBy: 'modifiedTime desc'
        })

        return NextResponse.json({ files: res.data.files })
    } catch (error: any) {
        console.error('Drive API Error:', error)
        // If token invalid, maybe 401?
        if (error.code === 401) {
            return NextResponse.json({ error: 'Token Expired' }, { status: 401 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
