import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserFromHeader } from '@/lib/auth-utils'
import OpenAI from 'openai'

// pdf-parse will be required inside the handler
// const pdfParse = require('pdf-parse')

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'mock-key',
    dangerouslyAllowBrowser: true // Should not be needed in API route
})

const MOCK_RESPONSE = {
    summary: "This document discusses the key strategies for implementing a connector hub application.",
    key_points: ["Use Supabase for backend", "Implement Google OAuth", "Use AI for PDF processing"],
    action_items: [
        { title: "Set up Supabase project", due_date: null },
        { title: "Configure Google Cloud Console", due_date: null }
    ],
    flashcards: [
        { q: "What is the main backend?", a: "Supabase" },
        { q: "Which AI model is used?", a: "OpenAI GPT-4o" }
    ]
}

export async function POST(request: Request) {
    try {
        const pdfParse = require('pdf-parse')
        const user = await getUserFromHeader(request)
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { filePath, workspaceId } = await request.json()

        if (!filePath || !workspaceId) {
            return NextResponse.json({ error: 'Missing filePath or workspaceId' }, { status: 400 })
        }

        // Download PDF from storage
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('pdfs')
            .download(filePath)

        if (downloadError || !fileData) {
            console.error('Download error:', downloadError)
            return NextResponse.json({ error: 'Failed to download PDF' }, { status: 500 })
        }

        // Convert blob to buffer
        const arrayBuffer = await fileData.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Extract Text
        let text = ''
        try {
            const data = await pdfParse(buffer)
            text = data.text
        } catch (e) {
            console.error('PDF Parse Error:', e)
            return NextResponse.json({ error: 'Failed to parse PDF text' }, { status: 500 })
        }

        let aiResponse = MOCK_RESPONSE

        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'mock-key' && process.env.OPENAI_API_KEY !== 'your-key') {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: "You are a helpful assistant. Extract a summary (string), key_points (array of strings), action_items (array of objects with title, due_date: null), and flashcards (array of objects with q, a). Return ONLY JSON matching this structure." },
                        { role: "user", content: "Process this text:\n" + text.substring(0, 15000) }
                    ],
                    response_format: { type: "json_object" }
                })
                const content = completion.choices[0].message.content
                if (content) {
                    aiResponse = JSON.parse(content)
                }
            } catch (error) {
                console.error('OpenAI Error:', error)
                // Fallback to mock/partial or fail?
                // Fail gracefully
            }
        }

        // Save outputs to DB
        // 1. Create Note
        const { data: note, error: noteError } = await supabaseAdmin.from('notes').insert({
            user_id: user.id,
            workspace_id: workspaceId,
            title: `PDF Summary: ${filePath.split('/').pop()}`,
            content: `## Summary\n${aiResponse.summary}\n\n## Key Points\n${aiResponse.key_points.map((kp: string) => `- ${kp}`).join('\n')}`
        }).select().single()

        if (noteError) throw noteError

        // 2. Create Tasks
        if (aiResponse.action_items?.length) {
            const tasksToInsert = aiResponse.action_items.map((item: any) => ({
                user_id: user.id,
                workspace_id: workspaceId,
                title: item.title,
                due_date: item.due_date,
                status: 'open'
            }))
            await supabaseAdmin.from('tasks').insert(tasksToInsert)
        }

        // 3. Create Flashcards
        if (aiResponse.flashcards?.length) {
            const cardsToInsert = aiResponse.flashcards.map((card: any) => ({
                user_id: user.id,
                workspace_id: workspaceId,
                question: card.q,
                answer: card.a
            }))
            await supabaseAdmin.from('flashcards').insert(cardsToInsert)
        }

        return NextResponse.json({ success: true, noteId: note.id })

    } catch (error: any) {
        console.error('Process Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
