"use client"
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { generateStudyMaterials } from '@/actions/study-actions'
import { calculateCost, MAX_CHUNK_SIZE, formatCost } from '@/lib/billing-utils'
import { deductTokens } from '@/actions/token-actions'
import { FileText, GraduationCap, ArrowRight, Loader2, BookOpen, BrainCircuit, AlertTriangle, Trash2, CheckCircle, Circle, X, ChevronLeft, ChevronRight } from 'lucide-react'

interface Doc {
    id: string
    title: string
    content: string
    updated_at: string
}

export default function StudyApp({ windowId }: { windowId: string }) {
    const [documents, setDocuments] = useState<Doc[]>([])
    const [activeDoc, setActiveDoc] = useState<Doc | null>(null)
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'notes' | 'flashcards'>('notes')
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
    // Cost Estimation State
    const [estimatedCost, setEstimatedCost] = useState<number>(0)
    const [contentLength, setContentLength] = useState<number>(0)
    const [isCalculatingCost, setIsCalculatingCost] = useState(false)

    // Load Documents
    useEffect(() => {
        fetchDocuments()
    }, [])

    const fetchDocuments = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                setLoading(false)
                return
            }

            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('user_id', user.id)
                .order('updated_at', { ascending: false })

            if (data) setDocuments(data)
        } catch (error) {
            console.error('Error fetching docs:', error)
        } finally {
            setLoading(false)
        }
    }

    // Load Saved Materials
    useEffect(() => {
        if (activeDoc) {
            fetchSavedMaterials()
        } else {
            setSavedMaterials([])
            setGeneratedContent(null)
        }
    }, [activeDoc, activeTab])

    const fetchSavedMaterials = async () => {
        if (!activeDoc) return

        try {
            const dbType = activeTab === 'notes' ? 'note' : 'flashcard'
            const { data, error } = await supabase
                .from('study_materials')
                .select('*')
                .eq('document_id', activeDoc.id)
                .eq('type', dbType)
                .order('created_at', { ascending: true })

            if (error) throw error

            if (data && data.length > 0) {
                const materials = data.map(row => ({
                    ...row.content,
                    db_id: row.id
                }))
                setSavedMaterials(materials)
                setGeneratedContent(null)
            } else {
                setSavedMaterials([])
            }
        } catch (err: any) {
            console.error('Fetch error:', err)
        }
    }

    // Estimate cost whenever active doc or tab changes
    useEffect(() => {
        estimateGenerationCost()
    }, [activeDoc, activeTab])

    const estimateGenerationCost = async () => {
        if (!activeDoc) {
            setEstimatedCost(0)
            setContentLength(0)
            return
        }

        setIsCalculatingCost(true)
        try {
            let content = ''
            if (activeTab === 'notes') {
                const { data } = await supabase
                    .from('documents')
                    .select('content')
                    .eq('id', activeDoc.id)
                    .single()
                content = data?.content || ''
            } else {
                const { data: existingNotes } = await supabase
                    .from('study_materials')
                    .select('content')
                    .eq('document_id', activeDoc.id)
                    .eq('type', 'note')

                if (existingNotes && existingNotes.length > 0) {
                    content = existingNotes.map(note => {
                        const c = typeof note.content === 'string' ? JSON.parse(note.content) : note.content
                        return `**${c.title}**\n${c.content}`
                    }).join('\n\n')
                }
            }

            // Calculate length and cost
            const cleanText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
            setContentLength(cleanText.length)
            setEstimatedCost(calculateCost(content, activeTab))
        } catch (e) {
            console.error("Cost estimation error:", e)
        } finally {
            setIsCalculatingCost(false)
        }
    }

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
                    .from('documents')
                    .select('content')
                    .eq('id', activeDoc.id)
                    .single()

                if (docError) throw docError
                contentToAnalyze = latestDoc.content || ''
            } else {
                const { data: existingNotes, error: notesError } = await supabase
                    .from('study_materials')
                    .select('content')
                    .eq('document_id', activeDoc.id)
                    .eq('type', 'note')

                if (notesError) throw notesError
                if (!existingNotes || existingNotes.length === 0) {
                    throw new Error('Please generate notes first before creating flashcards.')
                }

                const notesText = existingNotes.map(note => {
                    const content = typeof note.content === 'string' ? JSON.parse(note.content) : note.content
                    return `**${content.title}**\n${content.content}`
                }).join('\n\n')
                contentToAnalyze = notesText
            }

            // Deduct tokens based on calculated cost
            // Calculate exact cost for the content being sent
            const finalCost = calculateCost(contentToAnalyze, activeTab)
            const tokenResult = await deductTokens(user.id, finalCost)

            if (!tokenResult.success) {
                throw new Error(tokenResult.error || `Insufficient tokens. You need ${finalCost} tokens for this content.`)
            }



            const result = await generateStudyMaterials(
                contentToAnalyze,
                activeTab,
                activeDoc.id,
                user.id,
                activeTab === 'flashcards' ? { min: flashcardMin, max: flashcardMax } : undefined
            )
            setGeneratedContent(result)
            setSavedMaterials(result)
        } catch (err: any) {
            console.error('Generation error:', err)
            setError(err.message || 'Failed to generate study materials')
        } finally {
            setIsGenerating(false)
        }
    }

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds)
        if (newSet.has(id)) {
            newSet.delete(id)
        } else {
            newSet.add(id)
        }
        setSelectedIds(newSet)
    }

    const deleteSelected = async () => {
        if (selectedIds.size === 0) return

        try {
            const { error } = await supabase
                .from('study_materials')
                .delete()
                .in('id', Array.from(selectedIds))

            if (error) throw error

            await fetchSavedMaterials()
            setSelectedIds(new Set())
            setIsSelectionMode(false)
        } catch (err: any) {
            console.error('Delete error:', err)
            setError(err.message || 'Failed to delete items.')
        }
    }

    // Shuffle array function
    const shuffleArray = (array: any[]) => {
        const shuffled = [...array]
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
    }

    // Start play mode
    const startPlayMode = () => {
        const shuffled = shuffleArray(displayItems)
        setShuffledItems(shuffled)
        setModalIndex(0)
        setShowAnswer(false)
        setPlayMode(true)
    }

    // Navigate in play mode
    const playNext = () => {
        if (modalIndex < shuffledItems.length - 1) {
            setModalIndex(modalIndex + 1)
            setShowAnswer(false)
        }
    }

    const playPrev = () => {
        if (modalIndex > 0) {
            setModalIndex(modalIndex - 1)
            setShowAnswer(false)
        }
    }

    const displayItems = savedMaterials.length > 0 ? savedMaterials : (generatedContent || [])

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
                                onClick={() => { setActiveDoc(doc); setIsSelectionMode(false); setSelectedIds(new Set()); }}
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
                                    <button
                                        onClick={() => { setActiveTab('notes'); setIsSelectionMode(false); setSelectedIds(new Set()); }}
                                        className={`px-4 py-2 rounded-lg border-2 font-bold transition-all ${activeTab === 'notes'
                                            ? 'bg-[var(--cream-highlight)] border-[var(--accent-espresso)] shadow-[2px_2px_0px_var(--accent-espresso)]'
                                            : 'border-transparent hover:bg-[var(--accent-espresso)]/10'
                                            }`}
                                    >
                                        Notes
                                    </button>
                                    <button
                                        onClick={() => { setActiveTab('flashcards'); setIsSelectionMode(false); setSelectedIds(new Set()); }}
                                        className={`px-4 py-2 rounded-lg border-2 font-bold transition-all ${activeTab === 'flashcards'
                                            ? 'bg-[var(--cream-highlight)] border-[var(--accent-espresso)] shadow-[2px_2px_0px_var(--accent-espresso)]'
                                            : 'border-transparent hover:bg-[var(--accent-espresso)]/10'
                                            }`}
                                    >
                                        Flashcards
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {displayItems.length > 0 && (
                                    <>
                                        {isSelectionMode ? (
                                            <>
                                                <button
                                                    onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
                                                    className="px-3 py-2 text-sm font-bold hover:bg-[var(--accent-espresso)]/10 rounded-lg transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={deleteSelected}
                                                    disabled={selectedIds.size === 0}
                                                    className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg font-bold shadow-[3px_3px_0px_rgba(0,0,0,0.2)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_rgba(0,0,0,0.2)] active:translate-y-[0px] active:shadow-[0px_0px_0px_rgba(0,0,0,0.2)] transition-all disabled:opacity-50 disabled:pointer-events-none"
                                                >
                                                    <Trash2 size={16} />
                                                    Delete ({selectedIds.size})
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => setIsSelectionMode(true)}
                                                className="px-3 py-2 text-sm font-bold hover:bg-[var(--accent-espresso)]/10 rounded-lg transition-all"
                                            >
                                                Select
                                            </button>
                                        )}
                                    </>
                                )}

                                {/* Play Button - Only for Flashcards */}
                                {activeTab === 'flashcards' && displayItems.length > 0 && !isSelectionMode && (
                                    <button
                                        onClick={startPlayMode}
                                        className="flex items-center gap-2 bg-blue-500 text-white border-2 border-blue-700 px-4 py-2 rounded-lg font-bold shadow-[3px_3px_0px_rgba(0,0,0,0.3)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_rgba(0,0,0,0.3)] active:translate-y-[0px] active:shadow-[0px_0px_0px_rgba(0,0,0,0.3)] transition-all"
                                    >
                                        <GraduationCap size={18} />
                                        Play Quiz
                                    </button>
                                )}

                                {/* Flashcard Range Selector - Only for Flashcards */}
                                {activeTab === 'flashcards' && !isSelectionMode && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-lg">
                                        <span className="text-xs font-bold opacity-60">Cards:</span>
                                        <input
                                            type="number"
                                            min="5"
                                            max="100"
                                            value={flashcardMin}
                                            onChange={(e) => setFlashcardMin(Math.max(5, Math.min(100, parseInt(e.target.value) || 15)))}
                                            className="w-14 px-2 py-1 text-xs font-bold border border-[var(--accent-espresso)]/30 rounded text-center focus:outline-none focus:border-[var(--accent-espresso)] bg-[var(--bg-cream)] text-[var(--accent-espresso)]"
                                        />
                                        <span className="text-xs opacity-40">-</span>
                                        <input
                                            type="number"
                                            min="5"
                                            max="100"
                                            value={flashcardMax}
                                            onChange={(e) => setFlashcardMax(Math.max(flashcardMin, Math.min(100, parseInt(e.target.value) || 25)))}
                                            className="w-14 px-2 py-1 text-xs font-bold border border-[var(--accent-espresso)]/30 rounded text-center focus:outline-none focus:border-[var(--accent-espresso)] bg-[var(--bg-cream)] text-[var(--accent-espresso)]"
                                        />
                                    </div>
                                )}

                                {/* Cost Estimate */}
                                {activeDoc && (
                                    <div className="flex flex-col items-end mr-2 text-xs">
                                        <div className="font-bold text-[var(--accent-espresso)]">
                                            {isCalculatingCost ? (
                                                <Loader2 className="animate-spin w-3 h-3" />
                                            ) : (
                                                <span>{estimatedCost} Tokens</span>
                                            )}
                                        </div>
                                        <div className="opacity-50" title={`Max ${MAX_CHUNK_SIZE} chars per chunk`}>
                                            {contentLength > 0 ? `${(contentLength / 1000).toFixed(1)}k chars` : 'No content'}
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || isSelectionMode}
                                    className="flex items-center gap-2 bg-[var(--cream-highlight)] border-2 border-[var(--accent-espresso)] px-4 py-2 rounded-lg font-bold shadow-[3px_3px_0px_var(--accent-espresso)] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_var(--accent-espresso)] active:translate-y-[0px] active:shadow-[0px_0px_0px_var(--accent-espresso)] transition-all disabled:opacity-50 disabled:pointer-events-none"
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <BrainCircuit size={18} />}
                                    {activeTab === 'notes' ? 'Generate Notes' : 'Generate Flashcards'}
                                </button>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-8 bg-[var(--bg-cream)] relative">
                            {isGenerating ? (
                                <div className="h-full flex flex-col items-center justify-center opacity-60 gap-4">
                                    <Loader2 className="animate-spin w-12 h-12" />
                                    <div className="text-xl font-medium animate-pulse">Analyzing document...</div>
                                </div>
                            ) : error ? (
                                <div className="h-full flex flex-col items-center justify-center text-[var(--accent-peach)] gap-4">
                                    <AlertTriangle size={48} />
                                    <div className="text-xl font-bold">Generation Failed</div>
                                    <p className="max-w-md text-center">{error}</p>
                                </div>
                            ) : displayItems.length > 0 ? (
                                <div className="max-w-7xl mx-auto pb-20">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-2xl font-bold flex items-center gap-2 text-[var(--accent-espresso)]">
                                            {activeTab === 'notes' ? <BookOpen className="text-[var(--accent-espresso)]" /> : <GraduationCap className="text-[var(--accent-peach)]" />}
                                            {activeTab === 'notes' ? 'Study Notes' : 'Flashcards'}
                                        </h3>
                                        <div className="text-sm opacity-50 font-bold">{displayItems.length} items</div>
                                    </div>

                                    {/* 4-Column Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {displayItems.map((item: any, idx: number) => (
                                            <CardGridItem
                                                key={idx}
                                                item={item}
                                                type={activeTab}
                                                index={idx}
                                                isSelectionMode={isSelectionMode}
                                                isSelected={selectedIds.has(item.db_id)}
                                                onToggle={() => toggleSelection(item.db_id)}
                                                onClick={() => {
                                                    if (!isSelectionMode) {
                                                        setModalIndex(idx)
                                                        setModalOpen(true)
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
                                    <p className="max-w-md text-center">Click "Generate" above to create AI-powered notes or flashcards.</p>
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

            {/* Modal Viewer */}
            {modalOpen && displayItems.length > 0 && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setModalOpen(false)}
                >
                    {/* Navigation Buttons - Outside Modal */}
                    {displayItems.length > 1 && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setModalIndex((modalIndex - 1 + displayItems.length) % displayItems.length)
                                }}
                                className="absolute left-8 w-14 h-14 rounded-full bg-[var(--cream-highlight)] border-3 border-[var(--accent-espresso)] flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-[4px_4px_0px_var(--accent-espresso)] z-50"
                            >
                                <ChevronLeft size={28} strokeWidth={3} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    setModalIndex((modalIndex + 1) % displayItems.length)
                                }}
                                className="absolute right-8 w-14 h-14 rounded-full bg-[var(--cream-highlight)] border-3 border-[var(--accent-espresso)] flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-[4px_4px_0px_var(--accent-espresso)] z-50"
                            >
                                <ChevronRight size={28} strokeWidth={3} />
                            </button>
                        </>
                    )}

                    <div
                        className="relative bg-[var(--bg-surface)] border-4 border-[var(--accent-espresso)] rounded-2xl shadow-[8px_8px_0px_var(--accent-espresso)] max-w-4xl w-full max-h-[85vh] overflow-y-auto mx-16"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close Button */}
                        <button
                            onClick={() => setModalOpen(false)}
                            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-[var(--accent-espresso)] text-white flex items-center justify-center font-bold hover:scale-110 transition-transform z-10 shadow-[3px_3px_0px_rgba(0,0,0,0.3)]"
                        >
                            <X size={24} strokeWidth={3} />
                        </button>

                        {/* Content */}
                        <div className="p-12 pr-20">
                            <div className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4">
                                {activeTab === 'notes' ? 'Note' : 'Flashcard'} {modalIndex + 1} of {displayItems.length}
                            </div>

                            {activeTab === 'notes' ? (
                                <>
                                    <h2 className="text-4xl font-bold mb-8 text-[var(--accent-espresso)] leading-tight">
                                        {displayItems[modalIndex].title || "Untitled Topic"}
                                    </h2>
                                    <div className="prose prose-lg max-w-none text-[var(--accent-espresso)]/80 whitespace-pre-line leading-relaxed text-lg">
                                        {displayItems[modalIndex].content}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="mb-10">
                                        <span className="text-xs font-bold uppercase tracking-widest opacity-40 block mb-3">Question</span>
                                        <div className="text-3xl font-bold text-[var(--accent-espresso)] leading-tight">
                                            {displayItems[modalIndex].front}
                                        </div>
                                    </div>
                                    <div className="border-t-4 border-[var(--accent-espresso)]/20 pt-8">
                                        <span className="text-xs font-bold uppercase tracking-widest opacity-40 block mb-3">Answer</span>
                                        <div className="text-2xl font-medium text-[var(--accent-espresso)] leading-relaxed">
                                            {displayItems[modalIndex].back}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Play Mode Modal */}
            {playMode && shuffledItems.length > 0 && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
                    onClick={() => {
                        setPlayMode(false)
                        setShuffledItems([])
                        setShowAnswer(false)
                    }}
                >
                    {/* Navigation Buttons */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            playPrev()
                        }}
                        disabled={modalIndex === 0}
                        className="absolute left-8 w-14 h-14 rounded-full bg-[var(--cream-highlight)] border-3 border-[var(--accent-espresso)] flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-[4px_4px_0px_var(--accent-espresso)] z-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronLeft size={28} strokeWidth={3} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            playNext()
                        }}
                        disabled={modalIndex === shuffledItems.length - 1}
                        className="absolute right-8 w-14 h-14 rounded-full bg-[var(--cream-highlight)] border-3 border-[var(--accent-espresso)] flex items-center justify-center font-bold hover:scale-110 transition-transform shadow-[4px_4px_0px_var(--accent-espresso)] z-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <ChevronRight size={28} strokeWidth={3} />
                    </button>

                    {/* Flashcard */}
                    <div
                        className="relative bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-cream)] border-4 border-blue-600 rounded-3xl shadow-[12px_12px_0px_rgba(37,99,235,0.4)] max-w-3xl w-full min-h-[400px] mx-16 cursor-pointer transform transition-all hover:scale-[1.02]"
                        onClick={(e) => {
                            e.stopPropagation()
                            setShowAnswer(!showAnswer)
                        }}
                    >
                        {/* Close Button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setPlayMode(false)
                                setShuffledItems([])
                                setShowAnswer(false)
                            }}
                            className="absolute top-6 right-6 w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center font-bold hover:scale-110 transition-transform z-10 shadow-[3px_3px_0px_rgba(0,0,0,0.3)]"
                        >
                            <X size={24} strokeWidth={3} />
                        </button>

                        {/* Card Content */}
                        <div className="p-12 flex flex-col items-center justify-center min-h-[400px]">
                            <div className="text-xs font-bold uppercase tracking-widest opacity-40 mb-6 text-center">
                                Card {modalIndex + 1} of {shuffledItems.length}
                            </div>

                            {!showAnswer ? (
                                <>
                                    <div className="text-sm font-bold uppercase tracking-widest text-blue-600 mb-4">Question</div>
                                    <div className="text-3xl font-bold text-center text-gray-800 leading-tight mb-8">
                                        {shuffledItems[modalIndex].front}
                                    </div>
                                    <div className="text-sm opacity-50 italic animate-pulse">
                                        Click to reveal answer
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="text-sm font-bold uppercase tracking-widest text-green-600 mb-4">Answer</div>
                                    <div className="text-2xl font-medium text-center text-gray-800 leading-relaxed mb-8">
                                        {shuffledItems[modalIndex].back}
                                    </div>
                                    <div className="text-sm opacity-50 italic">
                                        Click to see question again
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="absolute bottom-0 left-0 right-0 h-2 bg-[var(--accent-espresso)]/10 rounded-b-2xl overflow-hidden">
                            <div
                                className="h-full bg-[var(--accent-espresso)] transition-all duration-300"
                                style={{ width: `${((modalIndex + 1) / shuffledItems.length) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Grid Card Component
interface CardGridItemProps {
    item: any
    type: 'notes' | 'flashcards'
    index: number
    isSelectionMode?: boolean
    isSelected?: boolean
    onToggle?: () => void
    onClick?: () => void
}

function CardGridItem({ item, type, index, isSelectionMode, isSelected, onToggle, onClick }: CardGridItemProps) {
    const handleClick = () => {
        if (isSelectionMode && onToggle) {
            onToggle()
        } else if (onClick) {
            onClick()
        }
    }

    if (type === 'notes') {
        return (
            <div
                onClick={handleClick}
                className={`group relative bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-xl transition-all cursor-pointer overflow-hidden h-48
                    ${isSelected ? 'bg-[var(--cream-highlight)] ring-2 ring-[var(--accent-espresso)] ring-offset-2' : ''}
                    shadow-[3px_3px_0px_rgba(0,0,0,0.1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,0.1)] hover:-translate-y-1
                `}
            >
                {isSelectionMode && (
                    <div className={`absolute top-2 right-2 transition-colors z-10 ${isSelected ? 'text-[var(--accent-espresso)]' : 'text-gray-300'}`}>
                        {isSelected ? <CheckCircle className="fill-[var(--bg-cream)]" size={24} /> : <Circle size={24} />}
                    </div>
                )}
                <div className="p-4 h-full flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-[var(--accent-espresso)] text-white flex items-center justify-center font-bold text-xs shrink-0">
                            {index + 1}
                        </div>
                        <h4 className="font-bold text-sm line-clamp-2">{item.title || "Untitled"}</h4>
                    </div>
                    <div className="text-xs opacity-60 line-clamp-4 flex-1">
                        {typeof item.content === 'string' ? item.content : JSON.stringify(item.content)}
                    </div>
                </div>
            </div>
        )
    }

    // Flashcard
    return (
        <div
            onClick={handleClick}
            className={`group relative bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-xl transition-all cursor-pointer overflow-hidden h-48
                ${isSelected ? 'bg-[var(--cream-highlight)] ring-2 ring-[var(--accent-espresso)] ring-offset-2' : ''}
                shadow-[3px_3px_0px_rgba(0,0,0,0.1)] hover:shadow-[5px_5px_0px_rgba(0,0,0,0.1)] hover:-translate-y-1
            `}
        >
            {isSelectionMode && (
                <div className={`absolute top-2 right-2 transition-colors z-10 ${isSelected ? 'text-[var(--accent-espresso)]' : 'text-gray-300'}`}>
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
