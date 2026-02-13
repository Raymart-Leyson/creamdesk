'use server'

import OpenAI from "openai"
import { supabaseAdmin } from '@/lib/supabase-admin'
import { MAX_CHUNK_SIZE, calculateCost } from '@/lib/billing-utils'
import { deductTokens, addTokens } from '@/actions/token-actions'

type QuizType = 'multiple_choice' | 'identification' | 'enumeration' | 'mixed'

export async function generateStudyMaterials(
    content: string,
    type: 'notes' | 'flashcards' | 'quiz',
    documentId: string,
    userId: string,
    options?: {
        // flashcard options (kept as before)
        min?: number
        max?: number
        // quiz options (new)
        quizType?: QuizType
        itemCount?: number
    }
) {
    const supabase = supabaseAdmin
    let tokensDeducted = false

    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

        // Strip HTML tags to get clean text
        const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

        if (!cleanText || cleanText.length < 10) {
            throw new Error("Document content is too short or empty to generate study materials.")
        }


        // ─── Token Deduction ───────────────────────────────────────────────────
        const estimatedCost = calculateCost(cleanText, type)
        const deduction = await deductTokens(userId, estimatedCost)

        if (!deduction.success) {
            throw new Error(deduction.error || "Insufficient tokens to generate study materials.")
        }

        tokensDeducted = true

        // ─── Quiz goes through its own path (no chunking needed — uses notes) ─
        if (type === 'quiz') {
            return generateQuiz(openai, supabase, cleanText, documentId, userId, {
                quizType: options?.quizType ?? 'mixed',
                itemCount: options?.itemCount ?? 10,
            })
        }

        // ─── Chunking for long documents ──────────────────────────────────────
        const chunks: string[] = []
        if (cleanText.length > MAX_CHUNK_SIZE) {
            for (let i = 0; i < cleanText.length; i += MAX_CHUNK_SIZE) {
                const chunk = cleanText.substring(i, i + MAX_CHUNK_SIZE + 500) // 500 char overlap
                chunks.push(chunk)
            }
        } else {
            chunks.push(cleanText)
        }

        // ─── Build prompts ─────────────────────────────────────────────────────
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
5. **STRICT RULE: Use ONLY information explicitly stated in the document. Do NOT add outside knowledge, extra definitions, or context not found in the source material.**

For each topic, create a NOTE with:
- A clear, descriptive title
- Comprehensive explanation with PROPER FORMATTING:
  * Use numbered lists (1., 2., 3.) for multiple points
  * Use \\n for line breaks between points and paragraphs
  * Include ALL key details, not just summaries
  * Add definitions, examples, and context ONLY if they appear in the document
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
- Don't summarize too much - include all testable details
- Stay strictly within the document's content`

            baseUserPrompt = `Create comprehensive exam preparation STUDY NOTES (NOT flashcards) from this content. Include ALL important information, definitions, concepts, and testable details that appear in the document:`
            temperature = 0.7

        } else {
            // flashcards — generated from notes content passed in
            const min = options?.min ?? 15
            const max = options?.max ?? 25

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
5. **STRICT RULE: Questions and answers must come ONLY from the provided notes. Do NOT add knowledge from outside the notes.**

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

            baseUserPrompt = `Create comprehensive exam preparation FLASHCARDS (NOT study notes) from these study notes. Cover ALL important concepts, definitions, and testable information from the notes only:`
            temperature = 0.3
        }

        // ─── Process all chunks ────────────────────────────────────────────────
        const allResults: any[] = []
        let previousChunkSummary = ''

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]
            const isMultiChunk = chunks.length > 1

            let userPrompt = baseUserPrompt

            if (isMultiChunk) {
                userPrompt += `\n\n[Part ${i + 1} of ${chunks.length}]`
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
                const min = options?.min ?? 15
                const max = options?.max ?? 25
                userPrompt += `---STUDY NOTES START---\n${chunk}\n---STUDY NOTES END---\n\nCreate ${min}-${max} FLASHCARDS (with "front" and "back" fields) covering ALL important concepts from the notes above. Return ONLY the JSON array of flashcard objects.`
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
                    const validItems = parsed.filter(item => {
                        if (type === 'notes') {
                            return item.title && item.content && !item.front && !item.back
                        } else {
                            return item.front && item.back && !item.title && !item.content
                        }
                    })

                    if (validItems.length > 0) {
                        allResults.push(...validItems)

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

        // ─── Save to Database ──────────────────────────────────────────────────
        const dbType = type === 'notes' ? 'note' : 'flashcard'

        const { error: deleteError } = await supabase
            .from('study_materials')
            .delete()
            .match({ document_id: documentId, type: dbType })

        if (deleteError) console.error("DB Delete Error:", deleteError)

        const rows: any[] = allResults.map(item => ({
            user_id: userId,
            document_id: documentId,
            type: dbType,
            content: item
        }))

        const { data: insertedData, error: insertError } = await supabase
            .from('study_materials')
            .insert(rows)
            .select()

        if (insertError) throw new Error(`Database Save Failed: ${insertError.message}`)

        if (insertedData) {
            return insertedData.map(row => ({ ...row.content, db_id: row.id }))
        }

        return []

    } catch (error: any) {
        // Refund tokens on failure
        if (tokensDeducted && typeof userId === 'string') {
            await addTokens(userId, calculateCost(content, type))
        }
        console.error('Generation Error:', error)
        throw new Error(error.message || 'Failed to generate study materials')
    }
}

// ─── Quiz Generator ─────────────────────────────────────────────────────────
// Quiz receives the already-concatenated notes text (not raw doc content).
// This keeps questions grounded in what the student has actually studied.
async function generateQuiz(
    openai: OpenAI,
    supabase: any,
    notesContent: string,
    documentId: string,
    userId: string,
    options: { quizType: QuizType; itemCount: number }
) {
    const { quizType, itemCount } = options

    const typeInstructions: Record<QuizType, string> = {
        multiple_choice: `ALL ${itemCount} questions must be type "multiple_choice".
Each has exactly 4 answer choices (strings in a "choices" array). Only one is correct.
Distractors must be plausible but clearly wrong upon careful reading of the notes.`,

        identification: `ALL ${itemCount} questions must be type "identification".
Each asks the student to name, identify, or state a specific term, concept, or fact from the notes.
The answer must be a short phrase (1–5 words).`,

        enumeration: `ALL ${itemCount} questions must be type "enumeration".
Each asks the student to list multiple items: steps, types, characteristics, reasons, or examples.
Each question must have 3–6 items in the "answers" array.`,

        mixed: `Distribute the ${itemCount} questions proportionally:
- ~40% type "multiple_choice" (4 choices, 1 correct answer string)
- ~35% type "identification" (short 1–5 word answer string)
- ~25% type "enumeration" (list of 3–6 items in answers array)
This tests different cognitive levels of recall and understanding.`,
    }

    const systemPrompt = `You are an expert quiz maker for exam preparation.
You receive study notes and create quiz questions to test student knowledge.

STRICT RULES:
- Create questions ONLY from the provided notes. Do NOT add outside knowledge.
- Every question must be answerable using only the notes content.
- Questions must test meaningful understanding, not trivial details.
- Include a brief explanation for each question referencing the notes.
- Do NOT write "according to the notes" or "the document says" inside question text.

QUESTION TYPE INSTRUCTIONS:
${typeInstructions[quizType]}

REQUIRED JSON FORMAT — return ONLY a valid JSON array, no markdown fences, no extra text:
[
  {
    "type": "multiple_choice",
    "question": "Question text?",
    "choices": ["Option A", "Option B", "Option C", "Option D"],
    "answer": "Option A",
    "explanation": "Brief explanation from the notes."
  },
  {
    "type": "identification",
    "question": "Question text?",
    "answer": "Short answer",
    "explanation": "Brief explanation from the notes."
  },
  {
    "type": "enumeration",
    "question": "List the [X] [items] of [topic]:",
    "answers": ["Item 1", "Item 2", "Item 3"],
    "explanation": "Brief explanation from the notes."
  }
]

Generate exactly ${itemCount} questions. Spread them evenly across all major topics in the notes.`

    const userPrompt = `Create exactly ${itemCount} quiz questions from these study notes.
Cover all major topics. All questions must come strictly from the notes content below.

---STUDY NOTES START---
${notesContent}
---STUDY NOTES END---

Return ONLY the JSON array of question objects. No markdown fences, no explanation text outside the JSON.`

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 6000,
    })

    const resultText = response.choices[0].message.content || ''
    const parsed = parseStudyJSON(resultText)

    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Failed to generate valid quiz questions from the notes.")
    }

    // Validate each question has the required fields
    const validQuestions = parsed.filter(q => {
        if (!q.type || !q.question) return false
        if (q.type === 'multiple_choice') return Array.isArray(q.choices) && q.choices.length === 4 && q.answer
        if (q.type === 'identification') return Boolean(q.answer)
        if (q.type === 'enumeration') return Array.isArray(q.answers) && q.answers.length >= 2
        return false
    })

    if (validQuestions.length === 0) {
        throw new Error("Generated quiz had no valid questions. Please try again.")
    }



    // Save as a single row containing all questions
    const { data: insertedData, error: insertError } = await supabase
        .from('study_materials')
        .insert({
            user_id: userId,
            document_id: documentId,
            type: 'quiz',
            content: { questions: validQuestions, quizType, itemCount },
        })
        .select()
        .single()

    if (insertError) throw new Error(`Database Save Failed: ${insertError.message}`)

    return { ...insertedData, questions: validQuestions, quizType, itemCount, db_id: insertedData.id }
}

// ─── JSON parser (unchanged from original) ───────────────────────────────────
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