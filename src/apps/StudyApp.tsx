"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { generateStudyMaterials } from '@/actions/study-actions'
import { calculateCost, MAX_CHUNK_SIZE, formatCost } from '@/lib/billing-utils'
import { deductTokens } from '@/actions/token-actions'
import {
    FileText, GraduationCap, ArrowRight, Loader2, BookOpen, BrainCircuit,
    AlertTriangle, Trash2, CheckCircle, Circle, X, ChevronLeft, ChevronRight,
    ClipboardList, Trophy, RotateCcw, Check
} from 'lucide-react'

interface Doc {
    id: string
    title: string
    content: string
    updated_at: string
}

// ─── Quiz Types ────────────────────────────────────────────────────────────────
type QuizType = 'multiple_choice' | 'identification' | 'enumeration' | 'mixed'

interface MultipleChoiceQuestion {
    type: 'multiple_choice'
    question: string
    choices: string[]
    answer: string
    explanation?: string
}

interface IdentificationQuestion {
    type: 'identification'
    question: string
    answer: string
    explanation?: string
}

interface EnumerationQuestion {
    type: 'enumeration'
    question: string
    answers: string[]
    explanation?: string
}

type QuizQuestion = MultipleChoiceQuestion | IdentificationQuestion | EnumerationQuestion

interface QuizState {
    questions: QuizQuestion[]
    userAnswers: (string | string[])[]
    submitted: boolean
    score: number
}

export default function StudyApp({ windowId }: { windowId: string }) {
    const [documents, setDocuments] = useState<Doc[]>([])
    const [activeDoc, setActiveDoc] = useState<Doc | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'notes' | 'flashcards' | 'quiz'>('notes')
    const [generatedContent, setGeneratedContent] = useState<any>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [savedMaterials, setSavedMaterials] = useState<any[]>([])

    // Modal state
    const [modalOpen, setModalOpen] = useState(false)
    const [modalIndex, setModalIndex] = useState(0)

    // Play mode state (for flashcards)
    const [playMode, setPlayMode] = useState(false)
    const [shuffledItems, setShuffledItems] = useState<any[]>([])
    const [showAnswer, setShowAnswer] = useState(false)

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [isSelectionMode, setIsSelectionMode] = useState(false)

    // Flashcard range state
    const [flashcardMin, setFlashcardMin] = useState(15)
    const [flashcardMax, setFlashcardMax] = useState(25)

    // ─── Quiz state ──────────────────────────────────────────────────────────────
    const [quizType, setQuizType] = useState<QuizType>('mixed')
    const [quizItemCount, setQuizItemCount] = useState(10)
    const [quizState, setQuizState] = useState<QuizState | null>(null)
    const [quizId, setQuizId] = useState<string | null>(null)
    const [enumInputs, setEnumInputs] = useState<Record<number, string[]>>({})

    // Cost Estimation State
    const [estimatedCost, setEstimatedCost] = useState<number>(0)
    const [contentLength, setContentLength] = useState<number>(0)
    const [isCalculatingCost, setIsCalculatingCost] = useState(false)

    // ─── Load Documents ──────────────────────────────────────────────────────────
    useEffect(() => { fetchDocuments() }, [])

    const fetchDocuments = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { setLoading(false); return }
            const { data } = await supabase
                .from('documents').select('*').eq('user_id', user.id)
                .order('updated_at', { ascending: false })
            if (data) setDocuments(data)
        } catch (e) { console.error('Error fetching docs:', e) }
        finally { setLoading(false) }
    }

    // ─── Load Saved Materials ────────────────────────────────────────────────────
    useEffect(() => {
        if (activeDoc) {
            fetchSavedMaterials()
        } else {
            setSavedMaterials([])
            setGeneratedContent(null)
            setQuizState(null)
        }
    }, [activeDoc, activeTab])

    const fetchSavedMaterials = async () => {
        if (!activeDoc) return
        try {
            const dbType = activeTab === 'notes' ? 'note' : activeTab === 'flashcards' ? 'flashcard' : 'quiz'
            const { data, error } = await supabase
                .from('study_materials').select('*')
                .eq('document_id', activeDoc.id).eq('type', dbType)
                .order('created_at', { ascending: true })
            if (error) throw error

            if (data && data.length > 0) {
                if (activeTab === 'quiz') {
                    // Load all quiz sessions as list items
                    const materials = data.map((row, index) => ({
                        ...row.content,
                        db_id: row.id,
                        title: `Quiz ${index + 1}`,
                        created_at: row.created_at
                    }))
                    setSavedMaterials(materials)
                    setQuizState(null)
                    setQuizId(null)
                } else {
                    const materials = data.map(row => ({ ...row.content, db_id: row.id }))
                    setSavedMaterials(materials)
                }
                setGeneratedContent(null)
            } else {
                setSavedMaterials([])
                if (activeTab === 'quiz') {
                    setQuizState(null)
                    setQuizId(null)
                }
            }
        } catch (err: any) { console.error('Fetch error:', err) }
    }

    // ─── Estimate cost ───────────────────────────────────────────────────────────
    useEffect(() => { estimateGenerationCost() }, [activeDoc, activeTab])

    const estimateGenerationCost = async () => {
        if (!activeDoc) { setEstimatedCost(0); setContentLength(0); return }
        setIsCalculatingCost(true)
        try {
            let content = ''
            if (activeTab === 'notes') {
                const { data } = await supabase.from('documents').select('content')
                    .eq('id', activeDoc.id).single()
                content = data?.content || ''
            } else {
                // Flashcards and Quiz both derive from notes
                const { data: existingNotes } = await supabase.from('study_materials')
                    .select('content').eq('document_id', activeDoc.id).eq('type', 'note')
                if (existingNotes && existingNotes.length > 0) {
                    content = existingNotes.map(note => {
                        const c = typeof note.content === 'string' ? JSON.parse(note.content) : note.content
                        return `**${c.title}**\n${c.content}`
                    }).join('\n\n')
                }
            }
            const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            setContentLength(cleanText.length)
            setEstimatedCost(calculateCost(content, activeTab === 'quiz' ? 'flashcards' : activeTab))
        } catch (e) { console.error('Cost estimation error:', e) }
        finally { setIsCalculatingCost(false) }
    }

    // ─── Generate ────────────────────────────────────────────────────────────────
    const handleGenerate = async () => {
        if (!activeDoc) return
        setIsGenerating(true)
        setError(null)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not authenticated')

            let contentToAnalyze = ''

            if (activeTab === 'notes') {
                const { data: latestDoc, error: docError } = await supabase
                    .from('documents').select('content').eq('id', activeDoc.id).single()
                if (docError) throw docError
                contentToAnalyze = latestDoc.content || ''
            } else {
                // Flashcards and Quiz are based on generated notes
                const { data: existingNotes, error: notesError } = await supabase
                    .from('study_materials').select('content')
                    .eq('document_id', activeDoc.id).eq('type', 'note')
                if (notesError) throw notesError
                if (!existingNotes || existingNotes.length === 0) {
                    throw new Error(
                        activeTab === 'flashcards'
                            ? 'Please generate notes first before creating flashcards.'
                            : 'Please generate notes first before creating a quiz.'
                    )
                }
                contentToAnalyze = existingNotes.map(note => {
                    const content = typeof note.content === 'string' ? JSON.parse(note.content) : note.content
                    return `**${content.title}**\n${content.content}`
                }).join('\n\n')
            }

            const finalCost = calculateCost(contentToAnalyze, activeTab === 'quiz' ? 'flashcards' : activeTab)
            const tokenResult = await deductTokens(user.id, finalCost)
            if (!tokenResult.success) {
                throw new Error(tokenResult.error || `Insufficient tokens. You need ${finalCost} tokens.`)
            }

            if (activeTab === 'quiz') {
                // Generate quiz via server action
                const result = await generateStudyMaterials(
                    contentToAnalyze,
                    'quiz' as any,
                    activeDoc.id,
                    user.id,
                    { quizType, itemCount: quizItemCount }
                )

                // Refresh saved materials to show new quiz
                await fetchSavedMaterials()

                // Auto-open new quiz
                /*
                const questions: QuizQuestion[] = result?.questions || result || []
                setQuizState({
                    questions,
                    userAnswers: questions.map(q => q.type === 'enumeration' ? [] : ''),
                    submitted: false,
                    score: 0,
                })
                setEnumInputs({})
                const newQuizId = result.db_id // Need to ensure generate returns db_id
                if (newQuizId) setQuizId(newQuizId)
                */
            } else {
                const result = await generateStudyMaterials(
                    contentToAnalyze,
                    activeTab,
                    activeDoc.id,
                    user.id,
                    activeTab === 'flashcards' ? { min: flashcardMin, max: flashcardMax } : undefined
                )
                setGeneratedContent(result)
                setSavedMaterials(result)
            }
        } catch (err: any) {
            console.error('Generation error:', err)
            setError(err.message || 'Failed to generate study materials')
        } finally {
            setIsGenerating(false)
        }
    }

    // ─── Quiz handlers ───────────────────────────────────────────────────────────
    const handleQuizAnswer = (qIndex: number, answer: string) => {
        if (!quizState || quizState.submitted) return
        const newAnswers = [...quizState.userAnswers]
        newAnswers[qIndex] = answer
        setQuizState({ ...quizState, userAnswers: newAnswers })
    }

    const handleEnumInput = (qIndex: number, itemIndex: number, value: string) => {
        if (!quizState || quizState.submitted) return
        const current = [...(enumInputs[qIndex] || [])]
        current[itemIndex] = value
        const newEnumInputs = { ...enumInputs, [qIndex]: current }
        setEnumInputs(newEnumInputs)
        const newAnswers = [...quizState.userAnswers]
        newAnswers[qIndex] = current.filter(Boolean)
        setQuizState({ ...quizState, userAnswers: newAnswers })
    }

    const submitQuiz = () => {
        if (!quizState) return
        let score = 0
        quizState.questions.forEach((q, i) => {
            const userAns = quizState.userAnswers[i]
            if (q.type === 'multiple_choice' || q.type === 'identification') {
                const correct = q.answer.trim().toLowerCase()
                const given = (userAns as string).trim().toLowerCase()
                if (given === correct || given.includes(correct) || correct.includes(given)) score++
            } else if (q.type === 'enumeration') {
                const correct = q.answers.map(a => a.trim().toLowerCase())
                const given = (userAns as string[]).map(a => a?.trim().toLowerCase() || '')
                const matched = correct.filter(c => given.some(g => g.includes(c) || c.includes(g)))
                if (matched.length >= Math.ceil(correct.length * 0.6)) score++
            }
        })
        setQuizState({ ...quizState, submitted: true, score })
    }

    const resetQuiz = () => {
        if (!quizState) return
        setQuizState({
            ...quizState,
            userAnswers: quizState.questions.map(q => q.type === 'enumeration' ? [] : ''),
            submitted: false,
            score: 0,
        })
        setEnumInputs({})
    }

    const openQuiz = (quizItem: any) => {
        const questions: QuizQuestion[] = quizItem.questions || []
        setQuizState({
            questions,
            userAnswers: questions.map(q => q.type === 'enumeration' ? [] : ''),
            submitted: false,
            score: 0,
        })
        setEnumInputs({})
        setQuizId(quizItem.db_id)
    }

    const closeQuiz = () => {
        setQuizState(null)
        setQuizId(null)
        setEnumInputs({})
    }

    // ─── Selection ───────────────────────────────────────────────────────────────
    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) newSet.delete(id)
        else newSet.add(id)
        setSelectedIds(newSet)
    }

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return
        try {
            const { error } = await supabase.from('study_materials').delete()
                .in('id', Array.from(selectedIds))
            if (error) throw error
            await fetchSavedMaterials()
            setSelectedIds(new Set())
            setIsSelectionMode(false)
        } catch (err: any) {
            setError(err.message || 'Failed to delete items.')
        }
    }

    // ─── Play mode ───────────────────────────────────────────────────────────────
    const shuffleArray = (array: any[]) => {
        const shuffled = [...array]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
    }

    const startPlayMode = () => {
        const shuffled = shuffleArray(displayItems)
        setShuffledItems(shuffled)
        setModalIndex(0)
        setShowAnswer(false)
        setPlayMode(true)
    }

    const playNext = () => {
        if (modalIndex < shuffledItems.length - 1) { setModalIndex(modalIndex + 1); setShowAnswer(false) }
    }
    const playPrev = () => {
        if (modalIndex > 0) { setModalIndex(modalIndex - 1); setShowAnswer(false) }
    }

    const displayItems = savedMaterials.length > 0 ? savedMaterials : (generatedContent || [])

    // ─── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full w-full bg-[var(--bg-cream)] text-[var(--accent-espresso)]">

            {/* Sidebar */}
            <div className="w-64 border-r-2 border-[var(--accent-espresso)] flex flex-col bg-[var(--bg-surface)]">
                <div className="p-4 border-b-2 border-[var(--accent-espresso)] bg-[var(--accent-espresso)]/5">
                    <h2 className="font-bold flex items-center gap-2">
                        <FileText size={18} />
                        Select Document
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {documents.length === 0 ? (
                        <div className="text-center p-4 opacity-50 text-sm">No documents found.</div>
                    ) : (
                        documents.map(doc => (
                            <button
                                key={doc.id}
                                onClick={() => { setActiveDoc(doc); setIsSelectionMode(false); setSelectedIds(new Set()); setQuizState(null); setQuizId(null) }}
                                className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm font-medium ${activeDoc?.id === doc.id
                                    ? 'bg-[var(--cream-highlight)] border-[var(--accent-espresso)] shadow-[2px_2px_0px_var(--accent-espresso)]'
                                    : 'border-transparent hover:bg-[var(--accent-espresso)]/5 hover:border-[var(--accent-espresso)]/20'
                                    }`}
                            >
                                <div className="truncate">{doc.title}</div>
                                <div className="text-xs opacity-60 mt-1">{new Date(doc.updated_at).toLocaleDateString()}</div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {activeDoc ? (
                    <>
                        {/* Header */}
                        <div className="h-16 border-b-2 border-[var(--accent-espresso)] flex items-center justify-between px-6 bg-[var(--bg-surface)]/50 backdrop-blur-sm">
                            <div className="flex items-center gap-4">
                                <span className="font-bold text-lg truncate max-w-[200px]">{activeDoc.title}</span>
                                <div className="h-6 w-[2px] bg-[var(--accent-espresso)]/20" />
                                <div className="flex gap-2">
                                    {(['notes', 'flashcards', 'quiz'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => { setActiveTab(tab); setIsSelectionMode(false); setSelectedIds(new Set()); setQuizState(null); setQuizId(null) }}
                                            className={`px-4 py-2 rounded-lg border-2 font-bold transition-all capitalize flex items-center gap-1.5 ${activeTab === tab
                                                ? 'bg-[var(--cream-highlight)] border-[var(--accent-espresso)] shadow-[2px_2px_0px_var(--accent-espresso)]'
                                                : 'border-transparent hover:bg-[var(--accent-espresso)]/10'
                                                }`}
                                        >
                                            {tab === 'notes' && <BookOpen size={14} />}
                                            {tab === 'flashcards' && <GraduationCap size={14} />}
                                            {tab === 'quiz' && <ClipboardList size={14} />}
                                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Selection controls (only notes/flashcards) */}
                                {activeTab !== 'quiz' && displayItems.length > 0 && (
                                    <>
                                        {isSelectionMode ? (
                                            <>
                                                <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()) }}
                                                    className="px-3 py-2 text-sm font-bold hover:bg-[var(--accent-espresso)]/10 rounded-lg transition-all">
                                                    Cancel
                                                </button>
                                                <button onClick={deleteSelected} disabled={selectedIds.size === 0}
                                                    className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg font-bold shadow-[3px_3px_0px_rgba(0,0,0,0.2)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_rgba(0,0,0,0.2)] active:translate-y-[0px] transition-all disabled:opacity-50 disabled:pointer-events-none">
                                                    <Trash2 size={16} />Delete ({selectedIds.size})
                                                </button>
                                            </>
                                        ) : (
                                            <button onClick={() => setIsSelectionMode(true)}
                                                className="px-3 py-2 text-sm font-bold hover:bg-[var(--accent-espresso)]/10 rounded-lg transition-all">
                                                Select
                                            </button>
                                        )}
                                    </>
                                )}

                                {/* Play Button (flashcards only) */}
                                {activeTab === 'flashcards' && displayItems.length > 0 && !isSelectionMode && (
                                    <button onClick={startPlayMode}
                                        className="flex items-center gap-2 bg-blue-500 text-white border-2 border-blue-700 px-4 py-2 rounded-lg font-bold shadow-[3px_3px_0px_rgba(0,0,0,0.3)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_rgba(0,0,0,0.3)] active:translate-y-[0px] transition-all">
                                        <GraduationCap size={18} />Play
                                    </button>
                                )}

                                {/* Flashcard Range */}
                                {activeTab === 'flashcards' && !isSelectionMode && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-lg">
                                        <span className="text-xs font-bold opacity-60">Cards:</span>
                                        <input type="number" min="5" max="100" value={flashcardMin}
                                            onChange={e => setFlashcardMin(Math.max(5, Math.min(100, parseInt(e.target.value) || 15)))}
                                            className="w-14 px-2 py-1 text-xs font-bold border border-[var(--accent-espresso)]/30 rounded text-center focus:outline-none focus:border-[var(--accent-espresso)] bg-[var(--bg-cream)]" />
                                        <span className="text-xs opacity-40">-</span>
                                        <input type="number" min="5" max="100" value={flashcardMax}
                                            onChange={e => setFlashcardMax(Math.max(flashcardMin, Math.min(100, parseInt(e.target.value) || 25)))}
                                            className="w-14 px-2 py-1 text-xs font-bold border border-[var(--accent-espresso)]/30 rounded text-center focus:outline-none focus:border-[var(--accent-espresso)] bg-[var(--bg-cream)]" />
                                    </div>
                                )}

                                {/* Quiz Controls */}
                                {activeTab === 'quiz' && !isSelectionMode && (
                                    <div className="flex items-center gap-2">
                                        {/* Quiz type selector */}
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-lg">
                                            <span className="text-xs font-bold opacity-60">Type:</span>
                                            <select
                                                value={quizType}
                                                onChange={e => setQuizType(e.target.value as QuizType)}
                                                className="text-xs font-bold bg-transparent focus:outline-none cursor-pointer"
                                            >
                                                <option value="mixed">Mixed</option>
                                                <option value="multiple_choice">Multiple Choice</option>
                                                <option value="identification">Identification</option>
                                                <option value="enumeration">Enumeration</option>
                                            </select>
                                        </div>
                                        {/* Item count */}
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-lg">
                                            <span className="text-xs font-bold opacity-60">Items:</span>
                                            <input
                                                type="number" min="5" max="50" value={quizItemCount}
                                                onChange={e => setQuizItemCount(Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
                                                className="w-14 px-2 py-1 text-xs font-bold border border-[var(--accent-espresso)]/30 rounded text-center focus:outline-none focus:border-[var(--accent-espresso)] bg-[var(--bg-cream)]"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Cost Estimate */}
                                {activeDoc && (
                                    <div className="flex flex-col items-end mr-2 text-xs">
                                        <div className="font-bold">
                                            {isCalculatingCost ? <Loader2 className="animate-spin w-3 h-3" /> : <span>{estimatedCost} Tokens</span>}
                                        </div>
                                        <div className="opacity-50">
                                            {contentLength > 0 ? `${(contentLength / 1000).toFixed(1)}k chars` : 'No content'}
                                        </div>
                                    </div>
                                )}

                                {/* Generate Button */}
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || isSelectionMode}
                                    className="flex items-center gap-2 bg-[var(--cream-highlight)] border-2 border-[var(--accent-espresso)] px-4 py-2 rounded-lg font-bold shadow-[3px_3px_0px_var(--accent-espresso)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_var(--accent-espresso)] active:translate-y-[0px] transition-all disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <BrainCircuit size={18} />}
                                    {activeTab === 'notes' ? 'Generate Notes' : activeTab === 'flashcards' ? 'Generate Flashcards' : 'Generate Quiz'}
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg-cream)] relative">
                            {isGenerating ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-60 gap-4">
                                    <Loader2 className="animate-spin w-12 h-12" />
                                    <div className="text-xl font-medium animate-pulse">
                                        {activeTab === 'quiz' ? 'Building your quiz...' : 'Analyzing document...'}
                                    </div>
                                </div>
                            ) : error ? (
                                <div className="h-full flex flex-col items-center justify-center text-[var(--accent-peach)] gap-4">
                                    <AlertTriangle size={48} />
                                    <div className="text-xl font-bold">Generation Failed</div>
                                    <p className="max-w-md text-center">{error}</p>
                                </div>
                            ) : (activeTab === 'quiz' && quizState) ? (
                                <QuizView
                                    quizState={quizState}
                                    enumInputs={enumInputs}
                                    onAnswer={handleQuizAnswer}
                                    onEnumInput={handleEnumInput}
                                    onSubmit={submitQuiz}
                                    onReset={resetQuiz}
                                    onClose={closeQuiz}
                                />
                            ) : displayItems.length > 0 ? (
                                <div className="max-w-7xl mx-auto pb-20">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-2xl font-bold flex items-center gap-2">
                                            {activeTab === 'notes' ? <BookOpen /> : activeTab === 'flashcards' ? <GraduationCap /> : <ClipboardList />}
                                            {activeTab === 'notes' ? 'Study Notes' : activeTab === 'flashcards' ? 'Flashcards' : 'Saved Quizzes'}
                                        </h3>
                                        <div className="text-sm opacity-50 font-bold">{displayItems.length} items</div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {displayItems.map((item: any, idx: number) => (
                                            <CardGridItem
                                                key={idx} item={item} type={activeTab} index={idx}
                                                isSelectionMode={isSelectionMode} isSelected={selectedIds.has(item.db_id)}
                                                onToggle={() => toggleSelection(item.db_id)}
                                                onClick={() => {
                                                    if (!isSelectionMode) {
                                                        if (activeTab === 'quiz') {
                                                            openQuiz(item)
                                                        } else {
                                                            setModalIndex(idx)
                                                            setModalOpen(true)
                                                        }
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center opacity-40 gap-4">
                                    <BrainCircuit size={64} strokeWidth={1} />
                                    <div className="text-xl font-medium">Ready to generate study materials</div>
                                    <p className="max-w-md text-center">
                                        {activeTab === 'quiz'
                                            ? 'Generate notes first, then click "Generate Quiz" above.'
                                            : 'Click "Generate" above to create AI-powered study materials.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 gap-4 bg-[var(--bg-cream)]">
                        <ArrowRight size={64} strokeWidth={1} />
                        <div className="text-2xl font-bold">Select a document to begin</div>
                    </div>
                )}
            </div>

            {/* ─── Modal Viewer ──────────────────────────────────────────────── */}
            {modalOpen && displayItems.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setModalOpen(false)}>
                    {displayItems.length > 1 && (
                        <>
                            <button onClick={e => { e.stopPropagation(); setModalIndex((modalIndex - 1 + displayItems.length) % displayItems.length) }}
                                className="absolute left-8 w-14 h-14 rounded-full bg-[var(--cream-highlight)] border-3 border-[var(--accent-espresso)] flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-[4px_4px_0px_var(--accent-espresso)] z-50">
                                <ChevronLeft size={28} strokeWidth={3} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); setModalIndex((modalIndex + 1) % displayItems.length) }}
                                className="absolute right-8 w-14 h-14 rounded-full bg-[var(--cream-highlight)] border-3 border-[var(--accent-espresso)] flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-[4px_4px_0px_var(--accent-espresso)] z-50">
                                <ChevronRight size={28} strokeWidth={3} />
                            </button>
                        </>
                    )}
                    <div className="relative bg-[var(--bg-surface)] border-4 border-[var(--accent-espresso)] rounded-2xl shadow-[8px_8px_0px_var(--accent-espresso)] max-w-4xl w-full max-h-[85vh] overflow-y-auto mx-16"
                        onClick={e => e.stopPropagation()}>
                        <button onClick={() => setModalOpen(false)}
                            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-[var(--accent-espresso)] text-white flex items-center justify-center font-bold hover:scale-110 transition-transform z-10 shadow-[3px_3px_0px_rgba(0,0,0,0.3)]">
                            <X size={24} strokeWidth={3} />
                        </button>
                        <div className="p-12 pr-20">
                            <div className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4">
                                {activeTab === 'notes' ? 'Note' : 'Flashcard'} {modalIndex + 1} of {displayItems.length}
                            </div>
                            {activeTab === 'notes' ? (
                                <>
                                    <h2 className="text-4xl font-bold mb-8 leading-tight">{displayItems[modalIndex].title || 'Untitled Topic'}</h2>
                                    <div className="prose prose-lg max-w-none opacity-80 whitespace-pre-line leading-relaxed text-lg">
                                        {displayItems[modalIndex].content}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="mb-10">
                                        <span className="text-xs font-bold uppercase tracking-widest opacity-40 block mb-3">Question</span>
                                        <div className="text-3xl font-bold leading-tight">{displayItems[modalIndex].front}</div>
                                    </div>
                                    <div className="border-t-4 border-[var(--accent-espresso)]/20 pt-8">
                                        <span className="text-xs font-bold uppercase tracking-widest opacity-40 block mb-3">Answer</span>
                                        <div className="text-2xl font-medium leading-relaxed">{displayItems[modalIndex].back}</div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Play Mode Modal ───────────────────────────────────────────── */}
            {playMode && shuffledItems.length > 0 && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
                    onClick={() => { setPlayMode(false); setShuffledItems([]); setShowAnswer(false) }}>
                    <button onClick={e => { e.stopPropagation(); playPrev() }} disabled={modalIndex === 0}
                        className="absolute left-8 w-14 h-14 rounded-full bg-[var(--cream-highlight)] border-3 border-[var(--accent-espresso)] flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-[4px_4px_0px_var(--accent-espresso)] z-50 disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronLeft size={28} strokeWidth={3} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); playNext() }} disabled={modalIndex === shuffledItems.length - 1}
                        className="absolute right-8 w-14 h-14 rounded-full bg-[var(--cream-highlight)] border-3 border-[var(--accent-espresso)] flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-[4px_4px_0px_var(--accent-espresso)] z-50 disabled:opacity-30 disabled:cursor-not-allowed">
                        <ChevronRight size={28} strokeWidth={3} />
                    </button>
                    <div className="relative bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-cream)] border-4 border-blue-600 rounded-3xl shadow-[12px_12px_0px_rgba(37,99,235,0.4)] max-w-3xl w-full min-h-[400px] mx-16 cursor-pointer transform transition-all hover:scale-[1.02]"
                        onClick={e => { e.stopPropagation(); setShowAnswer(!showAnswer) }}>
                        <button onClick={e => { e.stopPropagation(); setPlayMode(false); setShuffledItems([]); setShowAnswer(false) }}
                            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center font-bold hover:scale-110 transition-transform z-10 shadow-[3px_3px_0px_rgba(0,0,0,0.3)]">
                            <X size={24} strokeWidth={3} />
                        </button>
                        <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
                            <div className="text-xs font-bold uppercase tracking-widest opacity-40 mb-6 text-center">
                                Card {modalIndex + 1} of {shuffledItems.length}
                            </div>
                            {!showAnswer ? (
                                <>
                                    <div className="text-sm font-bold uppercase tracking-widest text-blue-600 mb-4">Question</div>
                                    <div className="text-3xl font-bold text-center text-gray-800 leading-tight mb-8">{shuffledItems[modalIndex].front}</div>
                                    <div className="text-sm opacity-50 italic animate-pulse">Click to reveal answer</div>
                                </>
                            ) : (
                                <>
                                    <div className="text-sm font-bold uppercase tracking-widest text-green-600 mb-4">Answer</div>
                                    <div className="text-2xl font-medium text-center text-gray-800 leading-relaxed mb-8">{shuffledItems[modalIndex].back}</div>
                                    <div className="text-sm opacity-50 italic">Click to see question again</div>
                                </>
                            )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-2 bg-[var(--accent-espresso)]/10 rounded-b-2xl overflow-hidden">
                            <div className="h-full bg-[var(--accent-espresso)] transition-all duration-300"
                                style={{ width: `${((modalIndex + 1) / shuffledItems.length) * 100}%` }} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Quiz View Component ───────────────────────────────────────────────────────
interface QuizViewProps {
    quizState: QuizState | null
    enumInputs: Record<number, string[]>
    onAnswer: (qIndex: number, answer: string) => void
    onEnumInput: (qIndex: number, itemIndex: number, value: string) => void
    onSubmit: () => void
    onReset: () => void
    onClose: () => void
}

function QuizView({ quizState, enumInputs, onAnswer, onEnumInput, onSubmit, onReset, onClose }: QuizViewProps) {
    if (!quizState) {
        return (
            <div className="h-full flex flex-col items-center justify-center opacity-40 gap-4">
                <ClipboardList size={64} strokeWidth={1} />
                <div className="text-xl font-medium">Select a quiz to start</div>
            </div>
        )
    }

    const { questions, userAnswers, submitted, score } = quizState
    const totalAnswered = userAnswers.filter(a => Array.isArray(a) ? a.length > 0 : a !== '').length
    const pct = submitted ? Math.round((score / questions.length) * 100) : 0

    return (
        <div className="max-w-3xl mx-auto pb-24">
            {/* Quiz header */}
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-bold flex items-center gap-2">
                    <ClipboardList />
                    Quiz
                </h3>
                <div className="flex items-center gap-3">
                    <button onClick={onClose}
                        className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--accent-espresso)] rounded-lg font-bold hover:bg-[var(--accent-espresso)]/10 transition-all text-sm">
                        <X size={16} /> Close
                    </button>
                    {submitted && (
                        <button onClick={onReset}
                            className="flex items-center gap-2 px-4 py-2 border-2 border-[var(--accent-espresso)] rounded-lg font-bold hover:bg-[var(--accent-espresso)]/10 transition-all">
                            <RotateCcw size={16} /> Retake
                        </button>
                    )}
                    <div className="text-sm opacity-50 font-bold">
                        {submitted ? `Score: ${score}/${questions.length}` : `${totalAnswered}/${questions.length} answered`}
                    </div>
                </div>
            </div>

            {/* Score result */}
            {submitted && (
                <div className={`mb-8 p-6 rounded-2xl border-4 flex items-center gap-6 ${pct >= 75
                    ? 'bg-green-50 border-green-400'
                    : pct >= 50
                        ? 'bg-yellow-50 border-yellow-400'
                        : 'bg-red-50 border-red-400'
                    }`}>
                    <Trophy size={48} className={pct >= 75 ? 'text-green-500' : pct >= 50 ? 'text-yellow-500' : 'text-red-400'} />
                    <div>
                        <div className="text-3xl font-bold">{score} / {questions.length}</div>
                        <div className="text-lg font-medium opacity-70">
                            {pct >= 90 ? 'Excellent! 🎉' : pct >= 75 ? 'Great job! 👍' : pct >= 50 ? 'Keep studying! 📚' : 'Review your notes and try again 💪'}
                        </div>
                    </div>
                    <div className="ml-auto text-5xl font-black opacity-20">{pct}%</div>
                </div>
            )}

            {/* Questions */}
            <div className="space-y-6">
                {questions.map((q, qIdx) => {
                    const userAns = userAnswers[qIdx]
                    const isCorrect = (() => {
                        if (!submitted) return null
                        if (q.type === 'multiple_choice' || q.type === 'identification') {
                            const correct = q.answer.trim().toLowerCase()
                            const given = (userAns as string).trim().toLowerCase()
                            return given === correct || given.includes(correct) || correct.includes(given)
                        } else {
                            const correct = q.answers.map(a => a.trim().toLowerCase())
                            const given = (userAns as string[]).map(a => a?.trim().toLowerCase() || '')
                            const matched = correct.filter(c => given.some(g => g.includes(c) || c.includes(g)))
                            return matched.length >= Math.ceil(correct.length * 0.6)
                        }
                    })()

                    return (
                        <div key={qIdx}
                            className={`bg-[var(--bg-surface)] border-2 rounded-xl overflow-hidden transition-all ${submitted
                                ? isCorrect
                                    ? 'border-green-400 shadow-[3px_3px_0px_rgba(74,222,128,0.4)]'
                                    : 'border-red-400 shadow-[3px_3px_0px_rgba(248,113,113,0.4)]'
                                : 'border-[var(--accent-espresso)] shadow-[3px_3px_0px_rgba(0,0,0,0.08)]'
                                }`}>
                            {/* Question header */}
                            <div className={`px-5 py-3 flex items-center gap-3 border-b-2 ${submitted
                                ? isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                                : 'border-[var(--accent-espresso)]/10 bg-[var(--accent-espresso)]/5'
                                }`}>
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${submitted
                                    ? isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                                    : 'bg-[var(--accent-espresso)] text-white'
                                    }`}>{qIdx + 1}</span>
                                <span className={`text-xs font-bold uppercase tracking-widest ${submitted
                                    ? isCorrect ? 'text-green-600' : 'text-red-600'
                                    : 'opacity-50'
                                    }`}>
                                    {q.type === 'multiple_choice' ? 'Multiple Choice'
                                        : q.type === 'identification' ? 'Identification'
                                            : 'Enumeration'}
                                </span>
                                {submitted && (
                                    <span className="ml-auto">
                                        {isCorrect ? <Check size={18} className="text-green-500" /> : <X size={18} className="text-red-500" />}
                                    </span>
                                )}
                            </div>

                            <div className="p-5">
                                <p className="font-bold text-base mb-4 leading-snug">{q.question}</p>

                                {/* Multiple Choice */}
                                {q.type === 'multiple_choice' && (
                                    <div className="space-y-2">
                                        {q.choices.map((choice, cIdx) => {
                                            const isSelected = userAns === choice
                                            const isCorrectChoice = submitted && choice.trim().toLowerCase() === q.answer.trim().toLowerCase()
                                            const isWrongSelected = submitted && isSelected && !isCorrectChoice
                                            return (
                                                <button key={cIdx}
                                                    onClick={() => !submitted && onAnswer(qIdx, choice)}
                                                    disabled={submitted}
                                                    className={`w-full text-left px-4 py-3 rounded-lg border-2 font-medium text-sm transition-all
                                                        ${isCorrectChoice ? 'bg-green-100 border-green-400 text-green-800'
                                                            : isWrongSelected ? 'bg-red-100 border-red-400 text-red-800'
                                                                : isSelected ? 'bg-[var(--cream-highlight)] border-[var(--accent-espresso)] shadow-[2px_2px_0px_var(--accent-espresso)]'
                                                                    : 'border-[var(--accent-espresso)]/20 hover:border-[var(--accent-espresso)]/50 hover:bg-[var(--accent-espresso)]/5'}
                                                        ${submitted ? 'cursor-default' : 'cursor-pointer'}
                                                    `}>
                                                    <span className="font-black mr-2 opacity-50">{String.fromCharCode(65 + cIdx)}.</span>
                                                    {choice}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Identification */}
                                {q.type === 'identification' && (
                                    <div>
                                        <input
                                            type="text"
                                            value={userAns as string}
                                            onChange={e => !submitted && onAnswer(qIdx, e.target.value)}
                                            disabled={submitted}
                                            placeholder="Type your answer..."
                                            className={`w-full px-4 py-3 rounded-lg border-2 font-medium text-sm focus:outline-none transition-all
                                                ${submitted
                                                    ? isCorrect
                                                        ? 'border-green-400 bg-green-50 text-green-800'
                                                        : 'border-red-400 bg-red-50 text-red-800'
                                                    : 'border-[var(--accent-espresso)]/30 focus:border-[var(--accent-espresso)] bg-[var(--bg-cream)]'}
                                            `}
                                        />
                                    </div>
                                )}

                                {/* Enumeration */}
                                {q.type === 'enumeration' && (
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold opacity-50 mb-2">
                                            List {q.answers.length} items:
                                        </div>
                                        {Array.from({ length: q.answers.length }).map((_, itemIdx) => {
                                            const val = enumInputs[qIdx]?.[itemIdx] || ''
                                            return (
                                                <div key={itemIdx} className="flex items-center gap-2">
                                                    <span className="text-xs font-black opacity-40 w-5 text-right shrink-0">{itemIdx + 1}.</span>
                                                    <input
                                                        type="text"
                                                        value={val}
                                                        onChange={e => !submitted && onEnumInput(qIdx, itemIdx, e.target.value)}
                                                        disabled={submitted}
                                                        placeholder={`Item ${itemIdx + 1}`}
                                                        className={`flex-1 px-3 py-2 rounded-lg border-2 font-medium text-sm focus:outline-none transition-all
                                                            ${submitted
                                                                ? 'border-[var(--accent-espresso)]/20 bg-[var(--bg-cream)] cursor-default'
                                                                : 'border-[var(--accent-espresso)]/30 focus:border-[var(--accent-espresso)] bg-[var(--bg-cream)]'}
                                                        `}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {/* Answer reveal after submit */}
                                {submitted && !isCorrect && (
                                    <div className="mt-4 p-3 bg-green-50 border-2 border-green-200 rounded-lg">
                                        <span className="text-xs font-black uppercase tracking-widest text-green-600 block mb-1">Correct Answer</span>
                                        {q.type === 'enumeration'
                                            ? <ul className="text-sm font-medium text-green-800 list-disc list-inside space-y-0.5">
                                                {q.answers.map((a, i) => <li key={i}>{a}</li>)}
                                            </ul>
                                            : <p className="text-sm font-medium text-green-800">{q.answer}</p>
                                        }
                                    </div>
                                )}
                                {submitted && q.explanation && (
                                    <div className="mt-3 p-3 bg-blue-50 border-2 border-blue-200 rounded-lg">
                                        <span className="text-xs font-black uppercase tracking-widest text-blue-600 block mb-1">Explanation</span>
                                        <p className="text-sm text-blue-800">{q.explanation}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Submit / Retake button */}
            {!submitted ? (
                <div className="fixed bottom-8 right-8">
                    <button
                        onClick={onSubmit}
                        className="flex items-center gap-2 bg-[var(--accent-espresso)] text-[var(--bg-cream)] px-8 py-4 rounded-xl font-black text-lg shadow-[5px_5px_0px_rgba(0,0,0,0.3)] hover:translate-y-[-3px] hover:shadow-[7px_7px_0px_rgba(0,0,0,0.3)] active:translate-y-[0px] transition-all"
                    >
                        <Check size={22} strokeWidth={3} />
                        Submit Quiz
                    </button>
                </div>
            ) : (
                <div className="fixed bottom-8 right-8">
                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 bg-[var(--accent-espresso)] text-[var(--bg-cream)] px-8 py-4 rounded-xl font-black text-lg shadow-[5px_5px_0px_rgba(0,0,0,0.3)] hover:translate-y-[-3px] hover:shadow-[7px_7px_0px_rgba(0,0,0,0.3)] active:translate-y-[0px] transition-all"
                    >
                        <RotateCcw size={22} strokeWidth={3} />
                        Retake Quiz
                    </button>
                </div>
            )}
        </div>
    )
}

// ─── Grid Card Component ───────────────────────────────────────────────────────
interface CardGridItemProps {
    item: any
    type: 'notes' | 'flashcards' | 'quiz'
    index: number
    isSelectionMode?: boolean
    isSelected?: boolean
    onToggle?: () => void
    onClick?: () => void
}

function CardGridItem({ item, type, index, isSelectionMode, isSelected, onToggle, onClick }: CardGridItemProps) {
    const handleClick = () => {
        if (isSelectionMode && onToggle) onToggle()
        else if (onClick) onClick()
    }

    if (type === 'quiz') {
        return (
            <div onClick={handleClick}
                className={`group relative bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-xl transition-all cursor-pointer overflow-hidden h-48
                    ${isSelected ? 'bg-[var(--cream-highlight)] ring-2 ring-[var(--accent-espresso)] ring-offset-2' : ''}
                    shadow-[3px_3px_0px_rgba(0,0,0,0.1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,0.1)] hover:-translate-y-1`}>
                {isSelectionMode && (
                    <div className={`absolute top-2 right-2 z-10 ${isSelected ? 'text-[var(--accent-espresso)]' : 'text-gray-300'}`}>
                        {isSelected ? <CheckCircle className="fill-[var(--bg-cream)]" size={24} /> : <Circle size={24} />}
                    </div>
                )}
                <div className="p-4 h-full flex flex-col gap-2">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--cream-highlight)] border-2 border-[var(--accent-espresso)] text-[var(--accent-espresso)] flex items-center justify-center font-bold text-xs shrink-0">
                            <ClipboardList size={16} />
                        </div>
                        <h4 className="font-bold text-sm truncate">{item.title || 'Untitled Quiz'}</h4>
                    </div>
                    <div className="flex-1 flex flex-col justify-center gap-2 text-xs opacity-70">
                        <div className="flex items-center gap-2">
                            <span className="font-bold">Type:</span> {item.quizType}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold">Questions:</span> {item.questions?.length || 0}
                        </div>
                        <div className="flex items-center gap-2 mt-auto text-[10px] opacity-50">
                            {new Date(item.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (type === 'notes') {
        return (
            <div onClick={handleClick}
                className={`group relative bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-xl transition-all cursor-pointer overflow-hidden h-48
                    ${isSelected ? 'bg-[var(--cream-highlight)] ring-2 ring-[var(--accent-espresso)] ring-offset-2' : ''}
                    shadow-[3px_3px_0px_rgba(0,0,0,0.1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,0.1)] hover:-translate-y-1`}>
                {isSelectionMode && (
                    <div className={`absolute top-2 right-2 z-10 ${isSelected ? 'text-[var(--accent-espresso)]' : 'text-gray-300'}`}>
                        {isSelected ? <CheckCircle className="fill-[var(--bg-cream)]" size={24} /> : <Circle size={24} />}
                    </div>
                )}
                <div className="p-4 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-[var(--accent-espresso)] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {index + 1}
                        </div>
                        <h4 className="font-bold text-sm line-clamp-2">{item.title || 'Untitled'}</h4>
                    </div>
                    <div className="text-xs opacity-60 line-clamp-4 flex-1">
                        {typeof item.content === 'string' ? item.content : JSON.stringify(item.content)}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div onClick={handleClick}
            className={`group relative bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-xl transition-all cursor-pointer overflow-hidden h-48
                ${isSelected ? 'bg-[var(--cream-highlight)] ring-2 ring-[var(--accent-espresso)] ring-offset-2' : ''}
                shadow-[3px_3px_0px_rgba(0,0,0,0.1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,0.1)] hover:-translate-y-1`}>
            {isSelectionMode && (
                <div className={`absolute top-2 right-2 z-10 ${isSelected ? 'text-[var(--accent-espresso)]' : 'text-gray-300'}`}>
                    {isSelected ? <CheckCircle className="fill-[var(--bg-cream)]" size={24} /> : <Circle size={24} />}
                </div>
            )}
            <div className="p-4 h-full flex flex-col justify-center">
                <span className="text-xs font-bold uppercase tracking-widest opacity-40 mb-2">Card {index + 1}</span>
                <div className="font-bold text-base line-clamp-4">{item.front}</div>
            </div>
        </div>
    )
}