export const MAX_CHUNK_SIZE = 15000

export const COST_PER_CHUNK_NOTES = 10
export const COST_PER_CHUNK_FLASHCARDS = 5
export const COST_FOR_QUIZ = 15

export function calculateCost(content: string, type: 'notes' | 'flashcards' | 'quiz'): number {
    if (!content) return 0

    // Clean text exactly as the server does
    const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

    if (cleanText.length < 10) return 0

    const chunks = Math.ceil(cleanText.length / MAX_CHUNK_SIZE)

    if (type === 'quiz') {
        return COST_FOR_QUIZ
    }

    const costPerChunk = type === 'notes' ? COST_PER_CHUNK_NOTES : COST_PER_CHUNK_FLASHCARDS

    return Math.max(costPerChunk, chunks * costPerChunk)
}

export function formatCost(cost: number): string {
    return `${cost} Token${cost !== 1 ? 's' : ''}`
}
