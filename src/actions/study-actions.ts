'use server'

import OpenAI from "openai"
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MAX_CHUNK_SIZE } from '@/lib/billing-utils'

export async function generateStudyMaterials(
    content: string,
    type: 'notes' | 'flashcards',
    documentId: string,
    userId: string,
    flashcardRange?: { min: number; max: number }
) {
    const supabase = supabaseAdmin

    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        // Strip HTML tags to get clean text
        const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

        if (!cleanText || cleanText.length < 10) {
            throw new Error("Document content is too short or empty to generate study materials.")
        }

        // Chunking for long documents to ensure complete coverage (imported MAX_CHUNK_SIZE)
        const chunks: string[] = []

        if (cleanText.length > MAX_CHUNK_SIZE) {
            // Split into chunks with overlap to avoid missing content at boundaries
            for (let i = 0; i < cleanText.length; i += MAX_CHUNK_SIZE) {
                const chunk = cleanText.substring(i, i + MAX_CHUNK_SIZE + 500) // 500 char overlap
                chunks.push(chunk)
            }
        } else {
            chunks.push(cleanText)
        }

        let systemPrompt = ''
        let baseUserPrompt = ''
        let temperature = 0.7

        if (type === 'notes') {
            systemPrompt = `You are an expert exam preparation tutor creating STUDY NOTES (NOT flashcards).

CRITICAL REQUIREMENTS:
1. **Cover ALL important information** - Don't skip any key concepts, definitions, or facts
2. **Identify ALL distinct topics/categories** in the content
3. **Be thorough and detailed** - Students will use these notes to study for exams
4. **Include everything testable** - Definitions, concepts, processes, examples, important names, dates, formulas, etc.

For each topic, create a NOTE with:
- A clear, descriptive title
- Comprehensive explanation with PROPER FORMATTING:
  * Use numbered lists (1., 2., 3.) for multiple points
  * Use \\n for line breaks between points and paragraphs
  * Include ALL key details, not just summaries
  * Add definitions, examples, and context
- Focus ONLY on information in the document
- Organize information logically for exam preparation

REQUIRED JSON FORMAT - Each note object MUST have "title" and "content":
[
  {
    "title": "Topic Name",
    "content": "Detailed explanation...\\n\\n1. First key point\\n2. Second key point\\n3. Third key point\\n\\nDefinitions:\\n- Term: definition\\n\\nExamples:\\n- Example 1\\n- Example 2"
  }
]

DO NOT CREATE FLASHCARDS. DO NOT use "front" and "back" fields. ONLY use "title" and "content".

IMPORTANT: 
- Use \\n for line breaks
- Be COMPREHENSIVE - students are relying on these notes for exams
- Don't summarize too much - include all testable details`

            baseUserPrompt = `Create comprehensive exam preparation STUDY NOTES (NOT flashcards) from this content. Include ALL important information, definitions, concepts, and testable details:`

            temperature = 0.7
        } else {
            // Flashcards - generated FROM existing notes
            const min = flashcardRange?.min || 15
            const max = flashcardRange?.max || 25

            systemPrompt = `You are an exam preparation expert creating FLASHCARDS (NOT study notes).

CRITICAL REQUIREMENTS:
1. **Create flashcards for ALL important concepts** in the notes
2. **Cover everything testable** - definitions, concepts, processes, examples, formulas
3. **Create multiple flashcards per topic** if needed to ensure complete coverage
4. **Include different question types**:
   - Definition questions ("What is X?")
   - Concept questions ("Explain Y")
   - Application questions ("How does Z work?")
   - Identification questions ("What term describes...?")

REQUIRED JSON FORMAT - Each flashcard object MUST have "front" and "back":
[
  {
    "front": "Question?",
    "back": "Answer"
  }
]

DO NOT CREATE STUDY NOTES. DO NOT use "title" and "content" fields. ONLY use "front" and "back".

Rules:
- Each flashcard has "front" (question) and "back" (answer)
- Questions should be clear and exam-like
- Answers should be accurate and complete
- DO NOT create flashcards about JSON format or instructions
- ONLY create flashcards about the actual subject matter
- Create ${min}-${max} flashcards to ensure thorough coverage`

            baseUserPrompt = `Create comprehensive exam preparation FLASHCARDS (NOT study notes) from these study notes. Cover ALL important concepts, definitions, and testable information:`

            temperature = 0.3
        }

        // Process all chunks and collect results
        const allResults: any[] = []
        let previousChunkSummary = '' // To maintain continuity

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]
            const isMultiChunk = chunks.length > 1

            let userPrompt = baseUserPrompt

            if (isMultiChunk) {
                userPrompt += `\n\n[Part ${i + 1} of ${chunks.length}]`

                // Add context from previous chunk for continuity
                if (i > 0 && previousChunkSummary) {
                    userPrompt += `\n\n[Context from previous section: ${previousChunkSummary}]`
                }

                userPrompt += `\n\n`
            } else {
                userPrompt += `\n\n`
            }

            if (type === 'notes') {
                userPrompt += `${chunk}\n\nGenerate detailed STUDY NOTES (with "title" and "content" fields) for ALL topics in this content. Use line breaks (\\n) for formatting. Return ONLY valid JSON array of note objects.`
            } else {
                const min = flashcardRange?.min || 15; const max = flashcardRange?.max || 25; userPrompt += `---STUDY NOTES START---\n${chunk}\n---STUDY NOTES END---\n\nCreate ${min}-${max} FLASHCARDS (with "front" and "back" fields) covering ALL important concepts. Return ONLY the JSON array of flashcard objects.`
            }

            try {
                const response = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature,
                    max_tokens: 4096,
                })

                const resultText = response.choices[0].message.content || ''
                const parsed = parseStudyJSON(resultText)

                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Validate structure based on type
                    const validItems = parsed.filter(item => {
                        if (type === 'notes') {
                            // Notes must have 'title' and 'content'
                            return item.title && item.content && !item.front && !item.back
                        } else {
                            // Flashcards must have 'front' and 'back'
                            return item.front && item.back && !item.title && !item.content
                        }
                    })

                    if (validItems.length > 0) {
                        allResults.push(...validItems)

                        // Create summary for next chunk continuity
                        if (isMultiChunk && i < chunks.length - 1) {
                            if (type === 'notes') {
                                const lastTopics = validItems.slice(-2).map((n: any) => n.title).join(', ')
                                previousChunkSummary = `Previous topics covered: ${lastTopics}`
                            } else {
                                previousChunkSummary = `Continuing flashcard generation from previous section`
                            }
                        }
                    }
                }
            } catch (chunkError) {
                console.error(`Error processing chunk ${i + 1}:`, chunkError)
                // Continue with other chunks even if one fails
            }
        }

        if (allResults.length === 0) {
            throw new Error("Failed to generate valid study materials from the document.")
        }

        // Save to Database
        const dbType = type === 'notes' ? 'note' : 'flashcard'

        // Delete old materials of this type for this doc
        const { error: deleteError } = await supabase
            .from('study_materials')
            .delete()
            .match({ document_id: documentId, type: dbType })

        if (deleteError) {
            console.error("DB Delete Error:", deleteError)
        }

        // Insert new batch
        const rows: any[] = allResults.map(item => ({
            user_id: userId,
            document_id: documentId,
            type: dbType,
            content: item // { title, content } or { front, back }
        }))

        const { data: insertedData, error: insertError } = await supabase
            .from('study_materials')
            .insert(rows)
            .select()

        if (insertError) {
            console.error("DB Save Error:", insertError)
            throw new Error(`Database Save Failed: ${insertError.message}`)
        }

        // Return the actual saved data with DB IDs
        if (insertedData) {
            return insertedData.map(row => ({
                ...row.content,
                db_id: row.id
            }))
        }

        return []
    } catch (error: any) {
        console.error('OpenAI API Error:', error)
        throw new Error(error.message || 'Failed to generate study materials')
    }
}

function parseStudyJSON(text: string) {
    text = text.replace(/```json/g, '').replace(/```/g, '').trim()
    try {
        return JSON.parse(text)
    } catch (e) {
        console.error("Failed to parse JSON", text)
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0])
            } catch (e2) {
                return []
            }
        }
        return []
    }
}

