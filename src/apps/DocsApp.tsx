"use client"
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Plus, Trash2, Printer, FileText, Download, Layout,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough, Subscript, Superscript,
    AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, CheckSquare,
    IndentDecrease, IndentIncrease, Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
    ZoomIn, ZoomOut, Undo, Redo, Search, Type, Palette, SplitSquareHorizontal,
    ChevronDown, X, MoreHorizontal, PaintBucket, Upload, Star, Share2,
    MessageSquare, Eye, Clock, HelpCircle, Folder
} from 'lucide-react'
import mammoth from 'mammoth'

interface Doc {
    id: string
    title: string
    content: string
    updated_at: string
}

interface PageSettings {
    size: 'a4' | 'letter'
    orientation: 'portrait' | 'landscape'
    marginTop: number
    marginBottom: number
    marginLeft: number
    marginRight: number
}

// Page dimensions in pixels at 96 DPI
const PAGE_DIMS = {
    a4: { portrait: { w: 794, h: 1123 }, landscape: { w: 1123, h: 794 } },
    letter: { portrait: { w: 816, h: 1056 }, landscape: { w: 1056, h: 816 } }
}

export default function DocsApp() {
    const [docs, setDocs] = useState<Doc[]>([])
    const [activeDoc, setActiveDoc] = useState<Doc | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

    // Editor state
    const editorRef = useRef<HTMLDivElement>(null)
    const saveTimeout = useRef<NodeJS.Timeout | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const docInputRef = useRef<HTMLInputElement>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)
    const selectionRef = useRef<Range | null>(null)

    // Page settings
    const [pageSettings, setPageSettings] = useState<PageSettings>({
        size: 'letter',
        orientation: 'portrait',
        marginTop: 96,
        marginBottom: 96,
        marginLeft: 96,
        marginRight: 96,
    })

    // UI state
    const [zoom, setZoom] = useState(100)
    const [showFindReplace, setShowFindReplace] = useState(false)
    const [findText, setFindText] = useState('')
    const [replaceText, setReplaceText] = useState('')
    const [showPageSettings, setShowPageSettings] = useState(false)
    const [wordCount, setWordCount] = useState(0)
    const [charCount, setCharCount] = useState(0)
    const [showWordCount, setShowWordCount] = useState(false)
    const [showOutline, setShowOutline] = useState(false)
    const [outlineItems, setOutlineItems] = useState<{ text: string; level: number; id: string }[]>([])

    // Toolbar dropdowns
    const [showFontMenu, setShowFontMenu] = useState(false)
    const [showSizeMenu, setShowSizeMenu] = useState(false)
    const [showHeadingMenu, setShowHeadingMenu] = useState(false)
    const [showLineSpacing, setShowLineSpacing] = useState(false)
    const [showTextColorPicker, setShowTextColorPicker] = useState(false)
    const [showHighlightPicker, setShowHighlightPicker] = useState(false)
    const [showInsertMenu, setShowInsertMenu] = useState(false)
    const [showFormatMenu, setShowFormatMenu] = useState(false)
    const [showTableMenu, setShowTableMenu] = useState(false)
    const [showFileMenu, setShowFileMenu] = useState(false)
    const [showEditMenu, setShowEditMenu] = useState(false)
    const [showViewMenu, setShowViewMenu] = useState(false)
    const [showHelpMenu, setShowHelpMenu] = useState(false)
    const [showExtMenu, setShowExtMenu] = useState(false)

    // Active formatting
    const [activeFormats, setActiveFormats] = useState({
        bold: false, italic: false, underline: false, strikethrough: false,
        subscript: false, superscript: false,
        alignLeft: true, alignCenter: false, alignRight: false, alignJustify: false
    })
    const [currentFont, setCurrentFont] = useState('Arial')
    const [currentSize, setCurrentSize] = useState('11')
    const [currentBlockType, setCurrentBlockType] = useState('Normal text')
    const [currentLineHeight, setCurrentLineHeight] = useState('1.15')

    // Table state
    const [selectedTable, setSelectedTable] = useState<HTMLTableElement | null>(null)
    const [selectedCell, setSelectedCell] = useState<HTMLTableCellElement | null>(null)
    const [showTableColorPicker, setShowTableColorPicker] = useState(false)

    // Image state
    const [selectedImage, setSelectedImage] = useState<HTMLElement | null>(null)

    const fonts = [
        'Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia',
        'Impact', 'Palatino Linotype', 'Tahoma', 'Times New Roman',
        'Trebuchet MS', 'Verdana', 'Roboto', 'Open Sans', 'Lato',
        'Montserrat', 'Oswald', 'Source Sans Pro', 'Raleway', 'PT Serif',
        'Merriweather', 'Nunito', 'Playfair Display', 'Ubuntu', 'Lora'
    ]
    const fontSizes = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72']
    const lineSpacings = ['1', '1.15', '1.5', '2', '2.5', '3']

    const headingStyles = [
        { label: 'Normal text', tag: 'p', className: 'text-sm' },
        { label: 'Title', tag: 'h1', className: 'text-3xl font-bold' },
        { label: 'Subtitle', tag: 'h2', className: 'text-xl text-gray-500 italic' },
        { label: 'Heading 1', tag: 'h1', className: 'text-2xl font-bold' },
        { label: 'Heading 2', tag: 'h2', className: 'text-xl font-bold' },
        { label: 'Heading 3', tag: 'h3', className: 'text-lg font-bold' },
        { label: 'Heading 4', tag: 'h4', className: 'text-base font-bold' },
    ]

    const textColors = [
        '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff',
        '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff', '#ff00ff',
        '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc',
        '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#9fc5e8', '#b4a7d6', '#d5a6bd',
        '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6fa8dc', '#8e7cc3', '#c27ba0',
        '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c8', '#674ea7', '#a64d79',
    ]

    const highlightColors = [
        '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff0000', '#0000ff', '#ffa500',
        '#ffffff', '#000000', '#c0c0c0', '#ffe599', '#d9ead3', '#d0e0e3', '#cfe2f3',
    ]

    // ─────────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────────
    useEffect(() => { fetchDocs() }, [])

    useEffect(() => {
        if (activeDoc && editorRef.current) {
            editorRef.current.innerHTML = activeDoc.content || '<p><br></p>'
            updateCounts()
            updateOutline()
        }
    }, [activeDoc?.id])

    useEffect(() => {
        document.addEventListener('selectionchange', handleSelectionChange)
        document.addEventListener('mousedown', handleGlobalMouseDown)
        return () => {
            document.removeEventListener('selectionchange', handleSelectionChange)
            document.removeEventListener('mousedown', handleGlobalMouseDown)
        }
    }, [])

    // Close dropdowns on outside click
    const handleGlobalMouseDown = useCallback((e: MouseEvent) => {
        const target = e.target as HTMLElement
        if (!target.closest('.gdocs-dropdown')) {
            setShowFontMenu(false)
            setShowSizeMenu(false)
            setShowHeadingMenu(false)
            setShowLineSpacing(false)
            setShowTextColorPicker(false)
            setShowHighlightPicker(false)
            setShowTableColorPicker(false)
            setShowInsertMenu(false)
            setShowFormatMenu(false)
            setShowTableMenu(false)
            setShowFileMenu(false)
            setShowEditMenu(false)
            setShowViewMenu(false)
            setShowHelpMenu(false)
            setShowExtMenu(false)
        }
    }, [])

    const handleSelectionChange = useCallback(() => {
        if (typeof document === 'undefined') return
        const sel = window.getSelection()
        if (!sel?.anchorNode) return
        const node = sel.anchorNode
        const el = node instanceof Element ? node : node.parentElement
        if (!el?.closest('#gdocs-editor')) return

        setActiveFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            strikethrough: document.queryCommandState('strikeThrough'),
            subscript: document.queryCommandState('subscript'),
            superscript: document.queryCommandState('superscript'),
            alignLeft: document.queryCommandState('justifyLeft'),
            alignCenter: document.queryCommandState('justifyCenter'),
            alignRight: document.queryCommandState('justifyRight'),
            alignJustify: document.queryCommandState('justifyFull'),
        })

        // Detect font
        try {
            const fontVal = document.queryCommandValue('fontName')
            if (fontVal) setCurrentFont(fontVal.replace(/"/g, ''))
        } catch (_) { }

        // Detect block type
        try {
            const blockVal = document.queryCommandValue('formatBlock')
            const mapping: Record<string, string> = {
                p: 'Normal text', h1: 'Heading 1', h2: 'Heading 2',
                h3: 'Heading 3', h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6',
                blockquote: 'Quote', pre: 'Code'
            }
            setCurrentBlockType(mapping[blockVal.toLowerCase()] || 'Normal text')
        } catch (_) { }
    }, [])

    // ─────────────────────────────────────────────
    // Database ops
    // ─────────────────────────────────────────────
    const fetchDocs = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const { data } = await supabase.from('documents').select('*')
            .eq('user_id', user.id).order('updated_at', { ascending: false })
        if (data) setDocs(data)
        setLoading(false)
    }

    const createDoc = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { alert('Please log in.'); return }
        const { data, error } = await supabase.from('documents').insert({
            user_id: user.id,
            title: 'Untitled document',
            content: '<p><br></p>'
        }).select().single()
        if (error) { console.error(error); return }
        if (data) { setDocs(prev => [data, ...prev]); setActiveDoc(data) }
    }

    const saveDoc = useCallback(async (id: string, content: string, title?: string) => {
        setSaveStatus('saving')
        const updates: any = { content }
        if (title !== undefined) updates.title = title
        const { error } = await supabase.from('documents').update(updates).eq('id', id)
        if (!error) {
            setDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d))
            setSaveStatus('saved')
        }
    }, [])

    const deleteDoc = async (id: string) => {
        if (!confirm('Delete this document?')) return
        await supabase.from('documents').delete().eq('id', id)
        setDocs(prev => prev.filter(d => d.id !== id))
        if (activeDoc?.id === id) setActiveDoc(null)
    }

    const triggerSave = useCallback(() => {
        if (!activeDoc || !editorRef.current) return
        setSaveStatus('unsaved')
        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => {
            saveDoc(activeDoc.id, editorRef.current!.innerHTML)
        }, 1500)
    }, [activeDoc, saveDoc])

    // ─────────────────────────────────────────────
    // Editor helpers
    // ─────────────────────────────────────────────
    const exec = useCallback((cmd: string, value?: string) => {
        editorRef.current?.focus()
        document.execCommand(cmd, false, value)
        triggerSave()
    }, [triggerSave])

    const updateCounts = useCallback(() => {
        if (!editorRef.current) return
        const text = editorRef.current.innerText || ''
        const words = text.trim() ? text.trim().split(/\s+/).length : 0
        setWordCount(words)
        setCharCount(text.length)
    }, [])

    const updateOutline = useCallback(() => {
        if (!editorRef.current) return
        const headings = editorRef.current.querySelectorAll('h1, h2, h3, h4, h5, h6')
        const items = Array.from(headings).map((h, i) => {
            const id = `outline-${i}`
            h.id = id
            return { text: h.textContent || '', level: parseInt(h.tagName[1]), id }
        })
        setOutlineItems(items)
    }, [])

    const handleEditorInput = useCallback(() => {
        updateCounts()
        updateOutline()
        triggerSave()
    }, [updateCounts, updateOutline, triggerSave])

    const handleEditorKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Ctrl+Z / Ctrl+Y handled by browser
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') return
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') return
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); exec('bold') }
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); exec('italic') }
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); exec('underline') }
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setShowFindReplace(true) }
    }, [exec])

    const handleEditorPaste = useCallback((e: React.ClipboardEvent) => {
        // Handle image paste
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault()
                const blob = items[i].getAsFile()
                if (!blob) continue
                const reader = new FileReader()
                reader.onload = (evt) => {
                    const src = evt.target?.result as string
                    insertImageHtml(src)
                }
                reader.readAsDataURL(blob)
                return
            }
        }
        // Strip external formatting for clean paste — allow plain text paste
        // Actually for docs we want to keep HTML structure from other sources
        // Let browser handle, but clean up after
    }, [])

    const insertImageHtml = (src: string) => {
        const html = `<img src="${src}" class="gdocs-img" style="max-width:100%;height:auto;display:block;margin:4px 0;cursor:pointer;" />`
        exec('insertHTML', html)
    }

    const applyFontFamily = (font: string) => {
        editorRef.current?.focus()
        // Restore selection if lost
        if (selectionRef.current) {
            const sel = window.getSelection()
            sel?.removeAllRanges()
            sel?.addRange(selectionRef.current)
        }
        document.execCommand('fontName', false, font)
        setCurrentFont(font)
        triggerSave()
    }

    const applyFontSize = (size: string) => {
        editorRef.current?.focus()
        if (selectionRef.current) {
            const sel = window.getSelection()
            sel?.removeAllRanges()
            sel?.addRange(selectionRef.current)
        }
        // Use 1-7 scale then fix with CSS
        // Map pt to execCommand size (approximate)
        const pt = parseInt(size)
        let execSize = '3'
        if (pt <= 8) execSize = '1'
        else if (pt <= 10) execSize = '2'
        else if (pt <= 12) execSize = '3'
        else if (pt <= 14) execSize = '4'
        else if (pt <= 18) execSize = '5'
        else if (pt <= 24) execSize = '6'
        else execSize = '7'

        document.execCommand('fontSize', false, execSize)

        // Fix all font elements to have correct pt size
        if (editorRef.current) {
            editorRef.current.querySelectorAll('font[size]').forEach(el => {
                const fontEl = el as HTMLElement
                fontEl.style.fontSize = `${size}pt`
                fontEl.removeAttribute('size')
            })
        }
        setCurrentSize(size)
        triggerSave()
    }

    const applyHeading = (tag: string) => {
        editorRef.current?.focus()
        document.execCommand('formatBlock', false, tag)
        setShowHeadingMenu(false)
        triggerSave()
    }

    const applyLineHeight = (lh: string) => {
        const sel = window.getSelection()
        if (!sel?.rangeCount) return
        const range = sel.getRangeAt(0)

        // Walk up to find the block-level ancestor
        let node: Node | null = range.commonAncestorContainer
        if (node.nodeType === Node.TEXT_NODE) node = node.parentNode

        // Find closest paragraph or block
        while (node && node.nodeName !== 'P' && node.nodeName !== 'DIV' &&
            !['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD'].includes(node.nodeName) &&
            node !== editorRef.current) {
            node = node.parentNode
        }

        if (node && node !== editorRef.current) {
            (node as HTMLElement).style.lineHeight = lh
        }
        setCurrentLineHeight(lh)
        setShowLineSpacing(false)
        triggerSave()
    }

    const insertTable = (rows: number, cols: number) => {
        let html = '<table style="border-collapse:collapse;width:100%;margin:8px 0;table-layout:fixed;">'
        for (let r = 0; r < rows; r++) {
            html += '<tr>'
            for (let c = 0; c < cols; c++) {
                html += `<td style="border:1px solid #c7c7c7;padding:6px 8px;min-width:30px;min-height:20px;word-break:break-word;vertical-align:top;"><p style="margin:0;min-height:1em;"><br></p></td>`
            }
            html += '</tr>'
        }
        html += '</table><p><br></p>'
        exec('insertHTML', html)
    }

    const [tablePickerHover, setTablePickerHover] = useState({ r: 0, c: 0 })

    const insertLink = () => {
        const url = prompt('Enter URL:', 'https://')
        if (url) exec('createLink', url)
    }

    const insertHorizontalRule = () => exec('insertHorizontalRule')

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (evt) => {
            const src = evt.target?.result as string
            insertImageHtml(src)
        }
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    // ─────────────────────────────────────────────
    // Find & Replace
    // ─────────────────────────────────────────────
    const [findCount, setFindCount] = useState(0)
    const handleFind = () => {
        if (!findText || !editorRef.current) return
        const content = editorRef.current.innerHTML
        const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        const matches = content.match(regex)
        setFindCount(matches?.length || 0)
            // Use browser find as fallback
            ; (window as any).find?.(findText)
    }

    const handleReplaceAll = () => {
        if (!findText || !editorRef.current) return
        const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        editorRef.current.innerHTML = editorRef.current.innerHTML.replace(regex, replaceText)
        triggerSave()
    }

    // ─────────────────────────────────────────────
    // File upload (DOCX / PDF)
    // ─────────────────────────────────────────────
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setLoading(true)
        try {
            let content = ''
            if (file.name.endsWith('.docx') || file.type.includes('wordprocessingml')) {
                // mammoth for DOCX — preserves styles faithfully
                const arrayBuffer = await file.arrayBuffer()
                const result = await mammoth.convertToHtml({
                    arrayBuffer,
                    // styleMap options to preserve more formatting
                }, {
                    includeEmbeddedStyleMap: true,
                    includeDefaultStyleMap: true,
                } as any)
                content = result.value
                // Clean up mammoth output
                content = content
                    .replace(/<br\s*\/?>/gi, '<br />')
                    .replace(/<p><\/p>/gi, '<p><br></p>')
            } else if (file.type === 'application/pdf') {
                content = await extractPdfContent(file)
            } else {
                alert('Unsupported file type. Please upload .docx or .pdf files.')
                setLoading(false)
                return
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { alert('Please log in.'); setLoading(false); return }

            const title = file.name.replace(/\.[^/.]+$/, '')
            const { data, error } = await supabase.from('documents').insert({
                user_id: user.id, title, content
            }).select().single()
            if (error) throw error
            if (data) { setDocs(prev => [data, ...prev]); setActiveDoc(data) }
        } catch (err: any) {
            console.error('Upload error:', err)
            alert('Failed to process file: ' + err.message)
        } finally {
            setLoading(false)
            if (docInputRef.current) docInputRef.current.value = ''
        }
    }

    const extractPdfContent = async (file: File): Promise<string> => {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
        const arrayBuffer = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        let fullHtml = ''

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum)
            const viewport = page.getViewport({ scale: 1 })
            const textContent = await page.getTextContent()
            const items = textContent.items as any[]
            const styles = textContent.styles

            if (!items.length) continue

            // Group items into lines by Y position
            const lineMap = new Map<number, any[]>()
            for (const item of items) {
                if (!item.str) continue
                const y = Math.round(item.transform[5])
                const roundedY = Math.round(y / 3) * 3
                if (!lineMap.has(roundedY)) lineMap.set(roundedY, [])
                lineMap.get(roundedY)!.push(item)
            }

            // Sort lines top-to-bottom (PDF Y is bottom-up)
            const sortedLines = Array.from(lineMap.entries()).sort((a, b) => b[0] - a[0])

            let pageHtml = ''
            let prevY = sortedLines[0]?.[0]
            const avgLineHeight = items.reduce((a, i) => a + (i.height || 12), 0) / items.length

            for (const [y, lineItems] of sortedLines) {
                // Sort items left to right
                lineItems.sort((a: any, b: any) => a.transform[4] - b.transform[4])

                const yDiff = prevY - y
                // Detect paragraph break (large Y gap)
                const isParaBreak = yDiff > avgLineHeight * 1.8

                let lineHtml = ''
                let prevItemEnd = 0

                for (const item of lineItems) {
                    const x = item.transform[4]
                    const str = item.str

                    // Add space if gap between items
                    if (prevItemEnd > 0 && x - prevItemEnd > 3) lineHtml += ' '

                    // Style detection
                    const fontObj = styles[item.fontName] || {}
                    const fontName = (fontObj.fontFamily || '').toLowerCase()
                    let style = ''
                    let isBold = fontName.includes('bold') || (item.fontName || '').toLowerCase().includes('bold')
                    let isItalic = fontName.includes('italic') || fontName.includes('oblique') ||
                        (item.fontName || '').toLowerCase().includes('italic')
                    let fontFamily = ''
                    if (fontName.includes('sans')) fontFamily = 'Arial, sans-serif'
                    else if (fontName.includes('mono') || fontName.includes('courier')) fontFamily = 'Courier New, monospace'
                    else fontFamily = 'Times New Roman, serif'

                    const fontSize = item.height ? `${Math.round(item.height)}pt` : ''
                    if (isBold) style += 'font-weight:bold;'
                    if (isItalic) style += 'font-style:italic;'
                    if (fontSize) style += `font-size:${fontSize};`
                    if (fontFamily) style += `font-family:${fontFamily};`

                    lineHtml += style
                        ? `<span style="${style}">${escapeHtml(str)}</span>`
                        : escapeHtml(str)

                    prevItemEnd = x + (item.width || str.length * (item.height || 12) * 0.6)
                }

                if (isParaBreak && pageHtml) {
                    pageHtml += '<br />'
                }
                pageHtml += `<p style="margin:0;line-height:1.4;">${lineHtml}</p>`
                prevY = y
            }

            // Try to extract images via canvas rendering
            try {
                const canvas = document.createElement('canvas')
                const scale = 1.5
                const vp = page.getViewport({ scale })
                canvas.width = vp.width
                canvas.height = vp.height
                const ctx = canvas.getContext('2d')
                if (ctx) {
                    await page.render({ canvasContext: ctx, viewport: vp }).promise
                    // We'll use this as a page image fallback only if text extraction fails
                    if (!pageHtml.trim()) {
                        const imgSrc = canvas.toDataURL('image/jpeg', 0.85)
                        pageHtml = `<img src="${imgSrc}" style="width:100%;height:auto;" />`
                    }
                }
            } catch (_) { }

            fullHtml += pageHtml
            if (pageNum < pdf.numPages) {
                fullHtml += `<div style="page-break-after:always;border-top:2px dashed #ccc;margin:24px 0;"></div>`
            }
        }

        return fullHtml || '<p>Unable to extract content from this PDF.</p>'
    }

    const escapeHtml = (str: string) =>
        str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    // ─────────────────────────────────────────────
    // Print / Export
    // ─────────────────────────────────────────────
    const handlePrint = () => {
        if (!activeDoc || !editorRef.current) return
        const { marginTop, marginBottom, marginLeft, marginRight } = pageSettings
        const printWin = window.open('', '_blank', 'width=900,height=700')
        if (!printWin) return
        printWin.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${activeDoc.title}</title>
                <style>
                    @page { size: ${pageSettings.size === 'a4' ? 'A4' : 'letter'} ${pageSettings.orientation}; margin: ${marginTop * 0.2646}mm ${marginRight * 0.2646}mm ${marginBottom * 0.2646}mm ${marginLeft * 0.2646}mm; }
                    * { box-sizing: border-box; }
                    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; margin: 0; padding: 0; }
                    table { border-collapse: collapse; width: 100%; }
                    td, th { border: 1px solid #c7c7c7; padding: 6px 8px; }
                    img { max-width: 100%; height: auto; }
                    h1 { font-size: 20pt; margin: 16pt 0 8pt; }
                    h2 { font-size: 16pt; margin: 14pt 0 6pt; }
                    h3 { font-size: 14pt; margin: 12pt 0 6pt; }
                    p { margin: 0 0 6pt; }
                </style>
            </head>
            <body>${editorRef.current.innerHTML}</body>
            </html>
        `)
        printWin.document.close()
        printWin.focus()
        setTimeout(() => { printWin.print() }, 500)
    }

    const handleDownloadDocx = () => {
        if (!activeDoc || !editorRef.current) return
        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
            <head><meta charset="utf-8"><title>${activeDoc.title}</title>
            <style>body{font-family:Arial;font-size:11pt;} table{border-collapse:collapse;} td{border:1px solid #ccc;padding:6px;}</style>
            </head><body>${editorRef.current.innerHTML}</body></html>`
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `${activeDoc.title}.doc`
        document.body.appendChild(a); a.click()
        document.body.removeChild(a); URL.revokeObjectURL(url)
    }

    const handleTitleChange = (title: string) => {
        if (!activeDoc) return
        setActiveDoc({ ...activeDoc, title })
        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => {
            saveDoc(activeDoc.id, editorRef.current?.innerHTML || '', title)
        }, 1000)
    }

    // ─────────────────────────────────────────────
    // Table click handler
    // ─────────────────────────────────────────────
    const handleEditorClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement
        const cell = target.closest('td, th') as HTMLTableCellElement
        const table = target.closest('table') as HTMLTableElement
        if (cell && table) {
            setSelectedCell(cell)
            setSelectedTable(table)
        } else if (!target.closest('.table-toolbar-inline')) {
            setSelectedCell(null)
            setSelectedTable(null)
        }
        // Image click
        if (target.tagName === 'IMG') {
            setSelectedImage(target as HTMLElement)
        } else {
            setSelectedImage(null)
        }
        // Save selection
        const sel = window.getSelection()
        if (sel?.rangeCount) selectionRef.current = sel.getRangeAt(0)
    }, [])

    // ─────────────────────────────────────────────
    // Page dims
    // ─────────────────────────────────────────────
    const pageDim = PAGE_DIMS[pageSettings.size][pageSettings.orientation]
    const pageW = pageDim.w * (zoom / 100)
    const pageH = pageDim.h * (zoom / 100)

    // ─────────────────────────────────────────────
    // DOCUMENT LIST VIEW
    // ─────────────────────────────────────────────
    if (!activeDoc) {
        return (
            <div className="flex flex-col h-full bg-white">
                {/* Google Docs style header */}
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="w-9 h-9 flex-shrink-0">
                            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M28 0H6C3.8 0 2 1.8 2 4v40c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V20L28 0Z" fill="#4285F4" />
                                <path d="M28 0v20h20L28 0Z" fill="#86AEED" />
                                <path d="M36 28H12v2h24v-2ZM36 32H12v2h24v-2ZM36 24H12v2h24v-2ZM22 16H12v2h10v-2Z" fill="white" />
                            </svg>
                        </div>
                        <span className="text-xl text-gray-700 font-medium tracking-tight" style={{ fontFamily: 'Google Sans, Arial, sans-serif' }}>Docs</span>
                        <div className="flex-1 max-w-sm ml-4">
                            <div className="flex items-center bg-gray-100 hover:bg-gray-200 rounded-full px-4 py-2 gap-2 transition-colors cursor-text">
                                <Search size={16} className="text-gray-500" />
                                <span className="text-sm text-gray-500">Search</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => docInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1a73e8] hover:bg-blue-50 rounded-full transition-colors"
                        >
                            <Upload size={16} />
                            Upload
                        </button>
                        <button
                            onClick={createDoc}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded-full transition-colors shadow-sm"
                        >
                            <Plus size={16} />
                            New
                        </button>
                    </div>
                    <input ref={docInputRef} type="file" className="hidden"
                        accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                        onChange={handleFileUpload} />
                </div>

                {/* Start a new document */}
                <div className="bg-[#f8f9fa] border-b border-gray-200 py-8 px-6">
                    <div className="max-w-5xl mx-auto">
                        <p className="text-sm text-gray-600 mb-4 font-medium">Start a new document</p>
                        <div className="flex gap-4 overflow-x-auto pb-2">
                            <button onClick={createDoc} className="flex flex-col items-center gap-2 flex-shrink-0 group">
                                <div className="w-[100px] h-[130px] bg-white border-2 border-transparent group-hover:border-[#1a73e8] rounded shadow-md flex items-center justify-center transition-all">
                                    <Plus size={32} className="text-gray-300 group-hover:text-[#1a73e8] transition-colors" />
                                </div>
                                <span className="text-xs text-gray-700">Blank</span>
                            </button>
                            {[
                                { name: 'Resume', color: '#fbbc04' },
                                { name: 'Report', color: '#34a853' },
                                { name: 'Letter', color: '#4285f4' },
                            ].map(tmpl => (
                                <button key={tmpl.name} onClick={createDoc} className="flex flex-col items-center gap-2 flex-shrink-0 group">
                                    <div className="w-[100px] h-[130px] bg-white border-2 border-transparent group-hover:border-[#1a73e8] rounded shadow-md transition-all overflow-hidden">
                                        <div className="h-2 w-full" style={{ backgroundColor: tmpl.color }} />
                                        <div className="p-2 pt-1">
                                            {[60, 80, 70, 90, 75].map((w, i) => (
                                                <div key={i} className="h-1 bg-gray-200 rounded mb-1.5" style={{ width: `${w}%` }} />
                                            ))}
                                        </div>
                                    </div>
                                    <span className="text-xs text-gray-700">{tmpl.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Recent documents */}
                <div className="flex-1 overflow-auto">
                    <div className="max-w-5xl mx-auto px-6 py-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-gray-700">Recent documents</h3>
                            <div className="flex items-center gap-2">
                                <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><List size={16} /></button>
                                <button className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><Layout size={16} /></button>
                            </div>
                        </div>
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="w-8 h-8 border-3 border-[#1a73e8]/20 border-t-[#1a73e8] rounded-full animate-spin" />
                            </div>
                        ) : docs.length === 0 ? (
                            <div className="text-center py-16 text-gray-500">
                                <FileText size={48} className="mx-auto mb-4 opacity-30" />
                                <p className="text-sm">No documents yet. Create your first one!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {docs.map(doc => (
                                    <div key={doc.id}
                                        onClick={() => setActiveDoc(doc)}
                                        className="group cursor-pointer rounded-lg border border-gray-200 hover:border-[#1a73e8] bg-white overflow-hidden shadow-sm hover:shadow-md transition-all"
                                    >
                                        <div className="h-[130px] bg-[#f8f9fa] p-4 overflow-hidden relative">
                                            <div className="text-[7px] leading-[1.4] text-gray-700 font-sans select-none pointer-events-none">
                                                {(doc.content || '').replace(/<[^>]*>/g, ' ').slice(0, 300)}
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#f8f9fa]" />
                                        </div>
                                        <div className="p-3 flex items-center gap-2">
                                            <div className="w-5 h-5 flex-shrink-0">
                                                <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M28 0H6C3.8 0 2 1.8 2 4v40c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V20L28 0Z" fill="#4285F4" />
                                                    <path d="M28 0v20h20L28 0Z" fill="#86AEED" />
                                                </svg>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{doc.title}</p>
                                                <p className="text-xs text-gray-500">{new Date(doc.updated_at).toLocaleDateString()}</p>
                                            </div>
                                            <button
                                                onClick={e => { e.stopPropagation(); deleteDoc(doc.id) }}
                                                className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    // ─────────────────────────────────────────────
    // EDITOR VIEW — Google Docs replica
    // ─────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-[#f8f9fa] overflow-hidden select-none">
            {/* ── Top Header Bar ─────────────────────────────── */}
            <div className="bg-white flex items-center gap-2 px-3 py-1.5 border-b border-gray-200 flex-shrink-0" style={{ minHeight: 56 }}>
                <button onClick={() => setActiveDoc(null)} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0">
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                {/* Doc icon */}
                <div className="w-8 h-8 flex-shrink-0">
                    <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M28 0H6C3.8 0 2 1.8 2 4v40c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V20L28 0Z" fill="#4285F4" />
                        <path d="M28 0v20h20L28 0Z" fill="#86AEED" />
                        <path d="M36 28H12v2h24v-2ZM36 32H12v2h24v-2ZM36 24H12v2h24v-2ZM22 16H12v2h10v-2Z" fill="white" />
                    </svg>
                </div>
                {/* Title */}
                <input
                    value={activeDoc.title}
                    onChange={e => handleTitleChange(e.target.value)}
                    className="text-lg font-normal text-gray-800 bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-[#1a73e8] focus:outline-none px-1 py-0.5 min-w-[200px] max-w-[400px] transition-colors"
                    style={{ fontFamily: 'Google Sans, Arial, sans-serif' }}
                />
                {/* Save status */}
                <div className="ml-1 flex-shrink-0">
                    {saveStatus === 'saving' && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                            <div className="w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                            Saving...
                        </span>
                    )}
                    {saveStatus === 'saved' && (
                        <span className="text-xs text-gray-500">✓ Saved to Drive</span>
                    )}
                </div>
                {/* Spacer */}
                <div className="flex-1" />
                {/* Action buttons */}
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowOutline(!showOutline)} className={`p-2 rounded-full transition-colors ${showOutline ? 'bg-blue-50 text-[#1a73e8]' : 'hover:bg-gray-100 text-gray-600'}`} title="Document outline">
                        <Eye size={18} />
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-full transition-colors" title="Print">
                        <Printer size={16} />
                        <span className="hidden sm:inline">Print</span>
                    </button>
                    <button onClick={handleDownloadDocx} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-full transition-colors" title="Download">
                        <Download size={16} />
                        <span className="hidden sm:inline">Download</span>
                    </button>
                    <button className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded-full transition-colors shadow-sm">
                        <Share2 size={14} />
                        Share
                    </button>
                </div>
            </div>

            {/* ── Menu Bar ──────────────────────────────────── */}
            <div className="bg-white flex items-center px-4 gap-0.5 border-b border-gray-200 flex-shrink-0" style={{ minHeight: 28 }}>
                {[
                    {
                        label: 'File', state: showFileMenu, toggle: () => { setShowFileMenu(v => !v); setShowEditMenu(false); setShowViewMenu(false); setShowInsertMenu(false); setShowFormatMenu(false); setShowTableMenu(false) },
                        items: [
                            { label: 'New', action: createDoc, icon: <Plus size={14} /> },
                            { label: 'Upload', action: () => docInputRef.current?.click(), icon: <Upload size={14} /> },
                            null,
                            { label: 'Print', action: handlePrint, icon: <Printer size={14} />, kbd: 'Ctrl+P' },
                            { label: 'Download as .doc', action: handleDownloadDocx, icon: <Download size={14} /> },
                        ]
                    },
                    {
                        label: 'Edit', state: showEditMenu, toggle: () => { setShowEditMenu(v => !v); setShowFileMenu(false); setShowViewMenu(false); setShowInsertMenu(false); setShowFormatMenu(false); setShowTableMenu(false) },
                        items: [
                            { label: 'Undo', action: () => exec('undo'), kbd: 'Ctrl+Z' },
                            { label: 'Redo', action: () => exec('redo'), kbd: 'Ctrl+Y' },
                            null,
                            { label: 'Cut', action: () => exec('cut'), kbd: 'Ctrl+X' },
                            { label: 'Copy', action: () => exec('copy'), kbd: 'Ctrl+C' },
                            { label: 'Paste', action: () => exec('paste'), kbd: 'Ctrl+V' },
                            null,
                            { label: 'Select all', action: () => exec('selectAll'), kbd: 'Ctrl+A' },
                            { label: 'Find & replace', action: () => setShowFindReplace(true), kbd: 'Ctrl+H' },
                        ]
                    },
                    {
                        label: 'View', state: showViewMenu, toggle: () => { setShowViewMenu(v => !v); setShowFileMenu(false); setShowEditMenu(false); setShowInsertMenu(false); setShowFormatMenu(false); setShowTableMenu(false) },
                        items: [
                            { label: 'Document outline', action: () => setShowOutline(v => !v), checked: showOutline },
                            { label: 'Word count', action: () => setShowWordCount(true) },
                            null,
                            { label: 'Zoom in', action: () => setZoom(z => Math.min(200, z + 10)), kbd: 'Ctrl++' },
                            { label: 'Zoom out', action: () => setZoom(z => Math.max(50, z - 10)), kbd: 'Ctrl+-' },
                            { label: `${zoom}%`, action: () => setZoom(100) },
                        ]
                    },
                    {
                        label: 'Insert', state: showInsertMenu, toggle: () => { setShowInsertMenu(v => !v); setShowFileMenu(false); setShowEditMenu(false); setShowViewMenu(false); setShowFormatMenu(false); setShowTableMenu(false) },
                        items: [
                            { label: 'Image', action: () => imageInputRef.current?.click(), icon: <ImageIcon size={14} /> },
                            { label: 'Table', action: () => { setShowInsertMenu(false); setShowTableMenu(true) }, icon: <TableIcon size={14} /> },
                            { label: 'Link', action: insertLink, icon: <LinkIcon size={14} />, kbd: 'Ctrl+K' },
                            { label: 'Horizontal line', action: insertHorizontalRule },
                            { label: 'Page break', action: () => exec('insertHTML', '<div style="page-break-after:always;border-top:2px dashed #ccc;margin:16px 0;"></div>') },
                        ]
                    },
                    {
                        label: 'Format', state: showFormatMenu, toggle: () => { setShowFormatMenu(v => !v); setShowFileMenu(false); setShowEditMenu(false); setShowViewMenu(false); setShowInsertMenu(false); setShowTableMenu(false) },
                        items: [
                            { label: 'Bold', action: () => exec('bold'), kbd: 'Ctrl+B' },
                            { label: 'Italic', action: () => exec('italic'), kbd: 'Ctrl+I' },
                            { label: 'Underline', action: () => exec('underline'), kbd: 'Ctrl+U' },
                            { label: 'Strikethrough', action: () => exec('strikeThrough') },
                            null,
                            { label: 'Superscript', action: () => exec('superscript'), kbd: 'Ctrl+.' },
                            { label: 'Subscript', action: () => exec('subscript'), kbd: 'Ctrl+,' },
                            null,
                            { label: 'Clear formatting', action: () => exec('removeFormat') },
                        ]
                    },
                ].map(menu => (
                    <div key={menu.label} className="relative gdocs-dropdown">
                        <button
                            onClick={menu.toggle}
                            className={`px-2 py-1 text-sm rounded transition-colors ${menu.state ? 'bg-blue-50 text-[#1a73e8]' : 'text-gray-700 hover:bg-gray-100'}`}
                        >
                            {menu.label}
                        </button>
                        {menu.state && (
                            <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[100] min-w-[200px] py-1">
                                {menu.items.map((item: any, i) =>
                                    item === null ? (
                                        <div key={i} className="h-px bg-gray-100 my-1" />
                                    ) : (
                                        <button
                                            key={i}
                                            onClick={() => { item.action?.(); menu.toggle() }}
                                            className="w-full flex items-center justify-between px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            <span className="flex items-center gap-2">
                                                {item.icon}
                                                {item.label}
                                            </span>
                                            {item.kbd && <span className="text-xs text-gray-400">{item.kbd}</span>}
                                        </button>
                                    )
                                )}
                            </div>
                        )}
                    </div>
                ))}

                {/* Table picker dropdown */}
                {showTableMenu && (
                    <div className="fixed inset-0 z-[99]" onClick={() => setShowTableMenu(false)}>
                        <div
                            className="absolute bg-white border border-gray-200 rounded shadow-xl p-3 z-[100] gdocs-dropdown"
                            style={{ top: 84, left: 400 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <p className="text-xs text-gray-500 mb-2 font-medium">Insert table</p>
                            <div className="grid" style={{ gridTemplateColumns: 'repeat(10, 24px)', gap: 2 }}>
                                {Array.from({ length: 100 }, (_, i) => {
                                    const r = Math.floor(i / 10) + 1
                                    const c = (i % 10) + 1
                                    const highlighted = r <= tablePickerHover.r && c <= tablePickerHover.c
                                    return (
                                        <div
                                            key={i}
                                            className={`w-5 h-5 border rounded-sm cursor-pointer transition-colors ${highlighted ? 'bg-blue-200 border-blue-400' : 'bg-gray-50 border-gray-200 hover:bg-blue-50'}`}
                                            onMouseEnter={() => setTablePickerHover({ r, c })}
                                            onClick={() => { insertTable(r, c); setShowTableMenu(false); setTablePickerHover({ r: 0, c: 0 }) }}
                                        />
                                    )
                                })}
                            </div>
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                {tablePickerHover.r > 0 ? `${tablePickerHover.r} × ${tablePickerHover.c}` : 'Hover to select'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Toolbar (Ribbon) ──────────────────────────── */}
            <div className="bg-white border-b border-gray-200 px-3 py-1.5 flex items-center gap-1 flex-wrap flex-shrink-0" style={{ minHeight: 42 }}>
                {/* Undo/Redo */}
                <div className="flex items-center gap-0.5 mr-1">
                    <ToolbarBtn title="Undo (Ctrl+Z)" onClick={() => exec('undo')}><Undo size={16} /></ToolbarBtn>
                    <ToolbarBtn title="Redo (Ctrl+Y)" onClick={() => exec('redo')}><Redo size={16} /></ToolbarBtn>
                    <ToolbarBtn title="Print (Ctrl+P)" onClick={handlePrint}><Printer size={16} /></ToolbarBtn>
                </div>
                <Sep />

                {/* Zoom */}
                <div className="flex items-center gap-0.5 text-xs text-gray-600 mr-1 gdocs-dropdown relative">
                    <button
                        onClick={() => setShowViewMenu(v => !v)}
                        className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-700 border border-gray-300 min-w-[58px] justify-between"
                    >
                        <span>{zoom}%</span>
                        <ChevronDown size={12} />
                    </button>
                </div>
                <Sep />

                {/* Heading / Block type */}
                <div className="relative gdocs-dropdown">
                    <button
                        onClick={() => { setShowHeadingMenu(v => !v); setShowFontMenu(false); setShowSizeMenu(false) }}
                        className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-700 border border-gray-300 min-w-[100px] max-w-[130px] justify-between"
                    >
                        <span className="truncate">{currentBlockType}</span>
                        <ChevronDown size={12} />
                    </button>
                    {showHeadingMenu && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[100] w-48 py-1">
                            {[
                                { label: 'Normal text', tag: 'p', style: 'text-sm' },
                                { label: 'Title', tag: 'h1', style: 'text-2xl font-bold' },
                                { label: 'Subtitle', tag: 'h2', style: 'text-xl text-gray-500' },
                                { label: 'Heading 1', tag: 'h1', style: 'text-xl font-bold' },
                                { label: 'Heading 2', tag: 'h2', style: 'text-lg font-bold' },
                                { label: 'Heading 3', tag: 'h3', style: 'text-base font-bold' },
                                { label: 'Heading 4', tag: 'h4', style: 'text-sm font-bold' },
                            ].map(h => (
                                <button key={h.label} onMouseDown={e => e.preventDefault()}
                                    onClick={() => applyHeading(h.tag)}
                                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${h.style} ${currentBlockType === h.label ? 'bg-blue-50' : ''}`}>
                                    {h.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <Sep />

                {/* Font family */}
                <div className="relative gdocs-dropdown">
                    <button
                        onClick={() => { setShowFontMenu(v => !v); setShowHeadingMenu(false); setShowSizeMenu(false) }}
                        onMouseDown={() => { const s = window.getSelection(); if (s?.rangeCount) selectionRef.current = s.getRangeAt(0) }}
                        className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded text-sm text-gray-700 border border-gray-300 min-w-[120px] max-w-[150px] justify-between"
                    >
                        <span className="truncate" style={{ fontFamily: currentFont }}>{currentFont}</span>
                        <ChevronDown size={12} />
                    </button>
                    {showFontMenu && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[100] w-56 max-h-64 overflow-y-auto py-1">
                            {fonts.map(f => (
                                <button key={f} onMouseDown={e => e.preventDefault()}
                                    onClick={() => { applyFontFamily(f); setShowFontMenu(false) }}
                                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 text-sm transition-colors ${currentFont === f ? 'bg-blue-50 text-[#1a73e8]' : ''}`}
                                    style={{ fontFamily: f }}>
                                    {f}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <Sep />

                {/* Font size */}
                <div className="relative gdocs-dropdown flex items-center">
                    <ToolbarBtn title="Decrease font size" onClick={() => applyFontSize(String(Math.max(6, parseInt(currentSize) - 1)))}>
                        <span className="text-xs font-bold">−</span>
                    </ToolbarBtn>
                    <button
                        onClick={() => { setShowSizeMenu(v => !v); setShowFontMenu(false); setShowHeadingMenu(false) }}
                        onMouseDown={() => { const s = window.getSelection(); if (s?.rangeCount) selectionRef.current = s.getRangeAt(0) }}
                        className="flex items-center gap-0.5 px-1 py-1 hover:bg-gray-100 rounded text-sm text-gray-700 border border-gray-300 w-12 justify-center"
                    >
                        {currentSize}
                    </button>
                    <ToolbarBtn title="Increase font size" onClick={() => applyFontSize(String(Math.min(96, parseInt(currentSize) + 1)))}>
                        <span className="text-xs font-bold">+</span>
                    </ToolbarBtn>
                    {showSizeMenu && (
                        <div className="absolute top-full left-6 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[100] w-20 max-h-48 overflow-y-auto py-1">
                            {fontSizes.map(s => (
                                <button key={s} onMouseDown={e => e.preventDefault()}
                                    onClick={() => { applyFontSize(s); setShowSizeMenu(false) }}
                                    className={`w-full text-left px-4 py-1.5 hover:bg-gray-50 text-sm transition-colors ${currentSize === s ? 'bg-blue-50 text-[#1a73e8]' : ''}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <Sep />

                {/* Bold / Italic / Underline / Strikethrough */}
                <div className="flex items-center gap-0.5">
                    <ToolbarBtn active={activeFormats.bold} title="Bold (Ctrl+B)" onMouseDown={e => { e.preventDefault(); exec('bold') }}><Bold size={16} /></ToolbarBtn>
                    <ToolbarBtn active={activeFormats.italic} title="Italic (Ctrl+I)" onMouseDown={e => { e.preventDefault(); exec('italic') }}><Italic size={16} /></ToolbarBtn>
                    <ToolbarBtn active={activeFormats.underline} title="Underline (Ctrl+U)" onMouseDown={e => { e.preventDefault(); exec('underline') }}><UnderlineIcon size={16} /></ToolbarBtn>
                    <ToolbarBtn active={activeFormats.strikethrough} title="Strikethrough" onMouseDown={e => { e.preventDefault(); exec('strikeThrough') }}><Strikethrough size={16} /></ToolbarBtn>
                </div>
                <Sep />

                {/* Text color */}
                <div className="relative gdocs-dropdown">
                    <button
                        onMouseDown={e => { e.preventDefault(); const s = window.getSelection(); if (s?.rangeCount) selectionRef.current = s.getRangeAt(0) }}
                        onClick={() => { setShowTextColorPicker(v => !v); setShowHighlightPicker(false) }}
                        className="flex flex-col items-center justify-center w-8 h-7 hover:bg-gray-100 rounded transition-colors"
                        title="Text color"
                    >
                        <span className="text-sm font-bold" style={{ color: '#000', lineHeight: 1, fontFamily: 'Arial' }}>A</span>
                        <div className="w-5 h-1 rounded-full mt-0.5 bg-black" />
                    </button>
                    {showTextColorPicker && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[100] p-2 w-60">
                            <p className="text-xs text-gray-500 mb-2 font-medium px-1">Text color</p>
                            <button onMouseDown={e => e.preventDefault()} onClick={() => { exec('foreColor', '#000000'); setShowTextColorPicker(false) }}
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 rounded mb-1">Automatic</button>
                            <div className="grid grid-cols-8 gap-1">
                                {textColors.map(c => (
                                    <button key={c} onMouseDown={e => e.preventDefault()}
                                        onClick={() => { exec('foreColor', c); setShowTextColorPicker(false) }}
                                        className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform shadow-sm"
                                        style={{ backgroundColor: c }}
                                        title={c}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Highlight color */}
                <div className="relative gdocs-dropdown">
                    <button
                        onMouseDown={e => { e.preventDefault(); const s = window.getSelection(); if (s?.rangeCount) selectionRef.current = s.getRangeAt(0) }}
                        onClick={() => { setShowHighlightPicker(v => !v); setShowTextColorPicker(false) }}
                        className="flex flex-col items-center justify-center w-8 h-7 hover:bg-gray-100 rounded transition-colors"
                        title="Highlight color"
                    >
                        <PaintBucket size={14} className="text-gray-600" />
                        <div className="w-5 h-1 rounded-full mt-0.5" style={{ backgroundColor: '#ffff00' }} />
                    </button>
                    {showHighlightPicker && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[100] p-2 w-44">
                            <p className="text-xs text-gray-500 mb-2 font-medium px-1">Highlight color</p>
                            <button onMouseDown={e => e.preventDefault()} onClick={() => { exec('hiliteColor', 'transparent'); setShowHighlightPicker(false) }}
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 rounded mb-1">None</button>
                            <div className="grid grid-cols-7 gap-1">
                                {highlightColors.map(c => (
                                    <button key={c} onMouseDown={e => e.preventDefault()}
                                        onClick={() => { exec('hiliteColor', c); setShowHighlightPicker(false) }}
                                        className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                                        style={{ backgroundColor: c }}
                                        title={c}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <Sep />

                {/* Superscript / Subscript */}
                <ToolbarBtn active={activeFormats.superscript} title="Superscript" onMouseDown={e => { e.preventDefault(); exec('superscript') }}><Superscript size={15} /></ToolbarBtn>
                <ToolbarBtn active={activeFormats.subscript} title="Subscript" onMouseDown={e => { e.preventDefault(); exec('subscript') }}><Subscript size={15} /></ToolbarBtn>
                <Sep />

                {/* Alignment */}
                <div className="flex items-center gap-0.5">
                    <ToolbarBtn active={activeFormats.alignLeft} title="Align left" onClick={() => exec('justifyLeft')}><AlignLeft size={16} /></ToolbarBtn>
                    <ToolbarBtn active={activeFormats.alignCenter} title="Align center" onClick={() => exec('justifyCenter')}><AlignCenter size={16} /></ToolbarBtn>
                    <ToolbarBtn active={activeFormats.alignRight} title="Align right" onClick={() => exec('justifyRight')}><AlignRight size={16} /></ToolbarBtn>
                    <ToolbarBtn active={activeFormats.alignJustify} title="Justify" onClick={() => exec('justifyFull')}><AlignJustify size={16} /></ToolbarBtn>
                </div>
                <Sep />

                {/* Line spacing */}
                <div className="relative gdocs-dropdown">
                    <button
                        onClick={() => setShowLineSpacing(v => !v)}
                        className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600"
                        title="Line & paragraph spacing"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6 4h15v2H6zm0 7h15v2H6zm0 7h15v2H6zM2 4l3 4-3 4V4zm0 0" />
                        </svg>
                    </button>
                    {showLineSpacing && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[100] w-36 py-1">
                            {lineSpacings.map(s => (
                                <button key={s} onClick={() => applyLineHeight(s)}
                                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${currentLineHeight === s ? 'text-[#1a73e8] bg-blue-50' : 'text-gray-700'}`}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <Sep />

                {/* Lists */}
                <div className="flex items-center gap-0.5">
                    <ToolbarBtn title="Bulleted list" onClick={() => exec('insertUnorderedList')}><List size={16} /></ToolbarBtn>
                    <ToolbarBtn title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered size={16} /></ToolbarBtn>
                    <ToolbarBtn title="Checklist" onClick={() => exec('insertHTML', '<ul style="list-style:none;padding-left:0;"><li><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" /><span>Item</span></label></li></ul>')}><CheckSquare size={16} /></ToolbarBtn>
                </div>
                <Sep />

                {/* Indent */}
                <ToolbarBtn title="Decrease indent" onClick={() => exec('outdent')}><IndentDecrease size={16} /></ToolbarBtn>
                <ToolbarBtn title="Increase indent" onClick={() => exec('indent')}><IndentIncrease size={16} /></ToolbarBtn>
                <Sep />

                {/* Clear formatting */}
                <ToolbarBtn title="Clear formatting" onClick={() => exec('removeFormat')}><X size={15} className="text-gray-500" /></ToolbarBtn>
                <Sep />

                {/* Find & Replace */}
                <ToolbarBtn title="Find & replace (Ctrl+H)" onClick={() => setShowFindReplace(true)}><Search size={16} /></ToolbarBtn>

                {/* Table toolbar — contextual */}
                {selectedTable && selectedCell && (
                    <>
                        <Sep />
                        <div className="flex items-center gap-1 bg-blue-50 rounded px-2 py-0.5 border border-blue-200 table-toolbar-inline">
                            <span className="text-xs text-blue-600 font-medium mr-1">Table:</span>
                            <ToolbarBtn title="Add row below" onClick={() => {
                                const row = selectedCell.parentElement as HTMLTableRowElement
                                if (!row) return
                                const newRow = selectedTable.insertRow(row.rowIndex + 1)
                                for (let i = 0; i < (selectedTable.rows[0]?.cells.length || 1); i++) {
                                    const c = newRow.insertCell()
                                    c.innerHTML = '<p style="margin:0;"><br></p>'
                                    c.style.cssText = 'border:1px solid #c7c7c7;padding:6px 8px;min-width:30px;vertical-align:top;word-break:break-word;'
                                }
                                triggerSave()
                            }}>+Row</ToolbarBtn>
                            <ToolbarBtn title="Add column right" onClick={() => {
                                const idx = selectedCell.cellIndex
                                Array.from(selectedTable.rows).forEach(row => {
                                    const c = row.insertCell(idx + 1)
                                    c.innerHTML = '<p style="margin:0;"><br></p>'
                                    c.style.cssText = 'border:1px solid #c7c7c7;padding:6px 8px;min-width:30px;vertical-align:top;word-break:break-word;'
                                })
                                triggerSave()
                            }}>+Col</ToolbarBtn>
                            {/* Cell bg color */}
                            <div className="relative gdocs-dropdown">
                                <button onClick={() => setShowTableColorPicker(v => !v)} className="px-1.5 py-1 hover:bg-blue-100 rounded text-xs text-blue-700">Fill</button>
                                {showTableColorPicker && (
                                    <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[100] p-2 w-36">
                                        <div className="grid grid-cols-5 gap-1">
                                            {['#ffffff', '#f8f9fa', '#fee2e2', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#fff3e0', '#e8eaf6', '#000000'].map(c => (
                                                <button key={c} onMouseDown={e => e.preventDefault()}
                                                    onClick={() => { selectedCell.style.backgroundColor = c; setShowTableColorPicker(false); triggerSave() }}
                                                    className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                                                    style={{ backgroundColor: c }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <ToolbarBtn title="Delete row" onClick={() => {
                                const row = selectedCell.parentElement as HTMLTableRowElement
                                if (row && row.rowIndex !== undefined) { selectedTable.deleteRow(row.rowIndex); setSelectedCell(null); triggerSave() }
                            }}><span className="text-red-500 text-xs">−Row</span></ToolbarBtn>
                            <ToolbarBtn title="Delete column" onClick={() => {
                                const idx = selectedCell.cellIndex
                                Array.from(selectedTable.rows).forEach(row => { if (row.cells[idx]) row.deleteCell(idx) })
                                setSelectedCell(null); triggerSave()
                            }}><span className="text-red-500 text-xs">−Col</span></ToolbarBtn>
                            <ToolbarBtn title="Delete table" onClick={() => {
                                selectedTable.remove(); setSelectedTable(null); setSelectedCell(null); triggerSave()
                            }}><Trash2 size={14} className="text-red-500" /></ToolbarBtn>
                        </div>
                    </>
                )}
            </div>

            {/* ── Main content area ─────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Outline panel */}
                {showOutline && (
                    <div className="w-56 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0 py-4 px-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Document outline</p>
                        {outlineItems.length === 0 ? (
                            <p className="text-xs text-gray-400">Add headings to create an outline</p>
                        ) : (
                            outlineItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                    className="w-full text-left text-sm text-gray-700 hover:text-[#1a73e8] py-1 truncate transition-colors block"
                                    style={{ paddingLeft: `${(item.level - 1) * 12}px` }}
                                >
                                    {item.text}
                                </button>
                            ))
                        )}
                    </div>
                )}

                {/* Editor canvas */}
                <div className="flex-1 overflow-y-auto overflow-x-auto bg-[#f8f9fa] py-8 px-4"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#d1d5db transparent' }}>

                    {/* Styles for editor content */}
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        #gdocs-editor { outline: none; caret-color: #000; }
                        #gdocs-editor p { margin: 0; min-height: 1.2em; }
                        #gdocs-editor ul, #gdocs-editor ol { padding-left: 2em; margin: 0; }
                        #gdocs-editor li { margin-bottom: 2px; }
                        #gdocs-editor h1 { font-size: 20pt; font-weight: bold; margin: 12pt 0 6pt; line-height: 1.2; }
                        #gdocs-editor h2 { font-size: 16pt; font-weight: bold; margin: 10pt 0 5pt; line-height: 1.2; }
                        #gdocs-editor h3 { font-size: 14pt; font-weight: bold; margin: 8pt 0 4pt; line-height: 1.2; }
                        #gdocs-editor h4 { font-size: 12pt; font-weight: bold; margin: 6pt 0 3pt; }
                        #gdocs-editor h5 { font-size: 11pt; font-weight: bold; margin: 5pt 0 3pt; }
                        #gdocs-editor h6 { font-size: 10pt; font-weight: bold; margin: 4pt 0 2pt; }
                        #gdocs-editor a { color: #1155cc; text-decoration: underline; }
                        #gdocs-editor blockquote { border-left: 3px solid #c7c7c7; margin: 8px 0 8px 20px; padding-left: 12px; color: #555; }
                        #gdocs-editor table { border-collapse: collapse; width: 100%; margin: 8px 0; table-layout: auto; }
                        #gdocs-editor td, #gdocs-editor th { border: 1px solid #c7c7c7; padding: 6px 8px; min-width: 30px; vertical-align: top; word-break: break-word; }
                        #gdocs-editor td p, #gdocs-editor th p { margin: 0; min-height: 1em; }
                        #gdocs-editor img.gdocs-img { max-width: 100%; height: auto; display: block; margin: 4px 0; cursor: pointer; outline: 2px solid transparent; transition: outline 0.15s; }
                        #gdocs-editor img.gdocs-img:hover, #gdocs-editor img.gdocs-img.selected { outline: 2px solid #1a73e8; outline-offset: 2px; }
                        #gdocs-editor hr { border: none; border-top: 2px solid #e0e0e0; margin: 16px 0; }
                        #gdocs-editor input[type="checkbox"] { width: 14px; height: 14px; cursor: pointer; }
                    `}} />

                    {/* The "page" — simulates A4/Letter paper */}
                    <div
                        className="mx-auto bg-white shadow-[0_1px_4px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.08)] relative"
                        style={{
                            width: pageW,
                            minHeight: pageH,
                        }}
                    >
                        {/* Margin guides (subtle) */}
                        <div
                            id="gdocs-editor"
                            ref={editorRef}
                            contentEditable
                            suppressContentEditableWarning
                            spellCheck
                            onInput={handleEditorInput}
                            onKeyDown={handleEditorKeyDown}
                            onPaste={handleEditorPaste}
                            onClick={handleEditorClick}
                            className="text-gray-900"
                            style={{
                                fontFamily: 'Arial, sans-serif',
                                fontSize: '11pt',
                                lineHeight: '1.15',
                                padding: `${pageSettings.marginTop * (zoom / 100)}px ${pageSettings.marginRight * (zoom / 100)}px ${pageSettings.marginBottom * (zoom / 100)}px ${pageSettings.marginLeft * (zoom / 100)}px`,
                                minHeight: pageH,
                                wordBreak: 'break-word',
                                overflowWrap: 'break-word',
                                whiteSpace: 'pre-wrap',
                            }}
                        />
                    </div>

                    {/* Word count bar */}
                    <div className="mx-auto mt-2 flex items-center justify-center gap-4" style={{ width: pageW }}>
                        <button onClick={() => setShowWordCount(true)} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                            {wordCount} words · {charCount} characters
                        </button>
                        <div className="flex items-center gap-2">
                            <ToolbarBtn title="Zoom out" onClick={() => setZoom(z => Math.max(50, z - 10))}><ZoomOut size={14} /></ToolbarBtn>
                            <span className="text-xs text-gray-500 w-10 text-center">{zoom}%</span>
                            <ToolbarBtn title="Zoom in" onClick={() => setZoom(z => Math.min(200, z + 10))}><ZoomIn size={14} /></ToolbarBtn>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Find & Replace Modal ──────────────────────── */}
            {showFindReplace && (
                <div className="fixed inset-0 z-[200] flex items-start justify-end p-4 pt-20 pointer-events-none">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-2xl p-4 w-80 pointer-events-auto">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-800">Find and replace</h3>
                            <button onClick={() => setShowFindReplace(false)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
                        </div>
                        <div className="space-y-2 mb-3">
                            <input
                                type="text" value={findText} onChange={e => setFindText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleFind() }}
                                placeholder="Search"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:border-[#1a73e8] focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                            />
                            <input
                                type="text" value={replaceText} onChange={e => setReplaceText(e.target.value)}
                                placeholder="Replace with"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:border-[#1a73e8] focus:outline-none focus:ring-1 focus:ring-[#1a73e8]"
                            />
                        </div>
                        {findCount > 0 && <p className="text-xs text-gray-500 mb-2">{findCount} match{findCount !== 1 ? 'es' : ''} found</p>}
                        <div className="flex gap-2">
                            <button onClick={handleFind} className="flex-1 px-3 py-1.5 text-sm font-medium text-[#1a73e8] border border-[#1a73e8] rounded hover:bg-blue-50 transition-colors">
                                Find
                            </button>
                            <button onClick={handleReplaceAll} className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-[#1a73e8] rounded hover:bg-[#1557b0] transition-colors">
                                Replace all
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Page Setup Modal ──────────────────────────── */}
            {showPageSettings && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30">
                    <div className="bg-white rounded-lg shadow-2xl p-6 w-96">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-800">Page setup</h3>
                            <button onClick={() => setShowPageSettings(false)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">Page size</label>
                                    <select value={pageSettings.size} onChange={e => setPageSettings(p => ({ ...p, size: e.target.value as any }))}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:border-[#1a73e8] focus:outline-none">
                                        <option value="letter">US Letter</option>
                                        <option value="a4">A4</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">Orientation</label>
                                    <select value={pageSettings.orientation} onChange={e => setPageSettings(p => ({ ...p, orientation: e.target.value as any }))}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:border-[#1a73e8] focus:outline-none">
                                        <option value="portrait">Portrait</option>
                                        <option value="landscape">Landscape</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-2 block">Margins (px)</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['marginTop', 'marginBottom', 'marginLeft', 'marginRight'] as const).map(key => (
                                        <div key={key}>
                                            <label className="text-[10px] text-gray-500 mb-0.5 block capitalize">{key.replace('margin', '')}</label>
                                            <input type="number" value={pageSettings[key]}
                                                onChange={e => setPageSettings(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                                                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:border-[#1a73e8] focus:outline-none" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4 justify-end">
                            <button onClick={() => setShowPageSettings(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors">Cancel</button>
                            <button onClick={() => setShowPageSettings(false)} className="px-4 py-2 text-sm text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded transition-colors">OK</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Word Count Modal ─────────────────────────── */}
            {showWordCount && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30">
                    <div className="bg-white rounded-lg shadow-2xl p-6 w-72">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-semibold text-gray-800">Word count</h3>
                            <button onClick={() => setShowWordCount(false)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
                        </div>
                        <div className="space-y-3">
                            {[
                                { label: 'Words', value: wordCount },
                                { label: 'Characters (no spaces)', value: charCount - (editorRef.current?.innerText.split(' ').length || 0) },
                                { label: 'Characters (with spaces)', value: charCount },
                            ].map(item => (
                                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                                    <span className="text-sm text-gray-600">{item.label}</span>
                                    <span className="text-sm font-semibold text-gray-800">{item.value.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setShowWordCount(false)} className="w-full mt-4 px-4 py-2 text-sm text-[#1a73e8] border border-[#1a73e8] rounded hover:bg-blue-50 transition-colors">
                            OK
                        </button>
                    </div>
                </div>
            )}

            {/* Hidden image input */}
            <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
        </div>
    )
}

// ─── Shared toolbar button component ─────────────────
function ToolbarBtn({ children, active, title, onClick, onMouseDown }: {
    children: React.ReactNode
    active?: boolean
    title?: string
    onClick?: () => void
    onMouseDown?: (e: React.MouseEvent) => void
}) {
    return (
        <button
            title={title}
            onClick={onClick}
            onMouseDown={onMouseDown}
            className={`p-1.5 rounded transition-colors text-sm font-medium ${active
                    ? 'bg-[#c2d7f5] text-[#1a73e8]'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
        >
            {children}
        </button>
    )
}

function Sep() {
    return <div className="w-px h-5 bg-gray-200 mx-0.5 flex-shrink-0" />
}