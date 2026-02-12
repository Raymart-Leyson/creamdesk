"use client"
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Plus, Trash2, Printer, FileText, Download, Layout,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough, Subscript, Superscript,
    AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, CheckSquare,
    IndentDecrease, IndentIncrease, Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
    ZoomIn, ZoomOut, Undo, Redo, Search, Type, Palette, FileImage, SplitSquareHorizontal,
    ChevronDown, X, Check, MoreHorizontal, PaintBucket, Upload
} from 'lucide-react'
import mammoth from 'mammoth'
import * as pdfjsLib from 'pdfjs-dist'

// Simple interface matching 'documents' table
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
    pageColor: string
}

const Page = ({ content, index, pageSettings, zoom, fontFamily, fontSize, lineHeight, onInput, onKeyDown, onPaste, setRef }: any) => {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (ref.current && content !== undefined) {
            // Only update DOM if the content prop explicitly changed (from State update)
            // This avoids overwriting user typing during other unrelated re-renders
            if (ref.current.innerHTML !== content) {
                ref.current.innerHTML = content
            }
        }
    }, [content])

    // Sync the local ref to the parent's ref array
    useEffect(() => {
        if (setRef) setRef(ref.current)
    }, [setRef])

    return (
        <div
            className="document-page shadow-[0_8px_40px_rgba(0,0,0,0.25)] outline-none cursor-text transition-all duration-200 relative"
            contentEditable
            suppressContentEditableWarning
            ref={ref}
            onInput={onInput}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            style={{
                fontFamily: fontFamily,
                fontSize: fontSize + 'pt',
                lineHeight: lineHeight,
                padding: `${pageSettings.marginTop}px ${pageSettings.marginRight}px ${pageSettings.marginBottom}px ${pageSettings.marginLeft}px`,
                color: 'var(--accent-espresso)',
                userSelect: 'text',
                WebkitUserSelect: 'text',
                width: `${(pageSettings.size === 'a4' ? (pageSettings.orientation === 'portrait' ? 816 : 1056) : (pageSettings.orientation === 'portrait' ? 816 : 1056)) * (zoom / 100)}px`,
                minHeight: `${1122 * (zoom / 100)}px`,
                height: `${1122 * (zoom / 100)}px`,
                overflow: 'hidden',
                backgroundColor: pageSettings.pageColor,
                border: '1px solid var(--accent-espresso)'
            }}
        />
    )
}

export default function DocsApp() {
    const [docs, setDocs] = useState<Doc[]>([])
    const [activeDoc, setActiveDoc] = useState<Doc | null>(null)
    const [loading, setLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [pages, setPages] = useState<string[]>([''])
    const pageRefs = useRef<(HTMLDivElement | null)[]>([])
    const saveTimeout = useRef<NodeJS.Timeout | null>(null)
    const lastSavedId = useRef<string | null>(null)
    const focusRequestRef = useRef<{ index: number, position: 'start' | 'end' } | null>(null) // Track focus request

    // Page settings
    const [pageSettings, setPageSettings] = useState<PageSettings>({
        size: 'a4',
        orientation: 'portrait',
        marginTop: 96,
        marginBottom: 96,
        marginLeft: 96,
        marginRight: 96,
        pageColor: 'var(--bg-cream)'
    })

    // Editor settings
    const [zoom, setZoom] = useState(100)
    const [fontSize, setFontSize] = useState('12')
    const [fontFamily, setFontFamily] = useState('Times New Roman')
    const [lineHeight, setLineHeight] = useState('1.6')
    const [showFindReplace, setShowFindReplace] = useState(false)
    const [findText, setFindText] = useState('')
    const [replaceText, setReplaceText] = useState('')
    const [activeTab, setActiveTab] = useState<'format' | 'insert' | 'layout' | 'table' | 'image'>('format')
    const [currentPage, setCurrentPage] = useState(1)

    // Dropdown states
    const [showFontMenu, setShowFontMenu] = useState(false)
    const [showSizeMenu, setShowSizeMenu] = useState(false)
    const [showHeadingMenu, setShowHeadingMenu] = useState(false)
    const [showLineSpacing, setShowLineSpacing] = useState(false)
    const [showPageSettings, setShowPageSettings] = useState(false)
    const [showTextColorPicker, setShowTextColorPicker] = useState(false)
    const [showHighlightColorPicker, setShowHighlightColorPicker] = useState(false)
    const [currentBlockType, setCurrentBlockType] = useState('Normal Text')

    // State for active formatting
    const [activeFormats, setActiveFormats] = useState({
        bold: false,
        italic: false,
        underline: false,
        strikethrough: false,
        subscript: false,
        superscript: false,
        alignLeft: false,
        alignCenter: false,
        alignRight: false,
        alignJustify: false
    })

    const checkActiveFormats = useCallback(() => {
        if (typeof document === 'undefined') return

        const selection = window.getSelection()
        if (selection?.anchorNode) {
            const node = selection.anchorNode
            const element = node instanceof Element ? node : node.parentElement
            const pageEl = element?.closest('.document-page') as HTMLDivElement
            if (pageEl) {
                const index = pageRefs.current.indexOf(pageEl)
                if (index !== -1) setCurrentPage(index + 1)
            }

            // Detect block type
            let current = node
            let newBlockType = 'Normal Text'
            while (current && current.nodeName !== 'DIV' && current.nodeName !== 'TD' && current.nodeName !== 'BODY') {
                const tag = current.nodeName.toLowerCase()
                if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].includes(tag)) {
                    if (tag === 'p') newBlockType = 'Normal Text'
                    else if (tag === 'h1') newBlockType = 'Heading 1'
                    else if (tag === 'h2') newBlockType = 'Heading 2'
                    else if (tag === 'h3') newBlockType = 'Heading 3'
                    else if (tag === 'h4') newBlockType = 'Heading 4'
                    else if (tag === 'h5') newBlockType = 'Heading 5'
                    else if (tag === 'h6') newBlockType = 'Heading 6'
                    break
                }
                current = current.parentNode as Node
            }
            setCurrentBlockType(newBlockType)
        }

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
            alignJustify: document.queryCommandState('justifyFull')
        })
    }, [])

    // State for ignoring initial load saves
    const skipNextSave = useRef(false)

    useEffect(() => {
        if (activeDoc) {
            // Initialize pages from content. 
            // Split by delimiter to restore pages
            const loadedContent = activeDoc.content || ''
            const splitPages = loadedContent.split('<div class="page-break"></div>')
            skipNextSave.current = true
            setPages(splitPages.length > 0 ? splitPages : [''])

            // Check formats on load
            document.addEventListener('selectionchange', checkActiveFormats)
            return () => document.removeEventListener('selectionchange', checkActiveFormats)
        }
    }, [activeDoc?.id])

    // Auto-save when pages change (creation/deletion) and handle focus
    useEffect(() => {
        // Restore focus if requested
        if (focusRequestRef.current) {
            const { index, position } = focusRequestRef.current
            const pageEl = pageRefs.current[index]

            if (pageEl) {
                // Determine the node to focus
                // If moving content, we want the start of the content we moved
                // If deleting, end of previous page
                pageEl.focus()

                // Small delay to ensure DOM is ready
                requestAnimationFrame(() => {
                    const selection = window.getSelection()
                    const range = document.createRange()

                    if (position === 'start') {
                        // If start, try to set cursor at beginning
                        if (pageEl.firstChild) {
                            range.setStart(pageEl.firstChild, 0)
                        } else {
                            range.setStart(pageEl, 0)
                        }
                    } else {
                        // If end, set cursor at end
                        range.selectNodeContents(pageEl)
                        range.collapse(false)
                    }

                    selection?.removeAllRanges()
                    selection?.addRange(range)
                })

                focusRequestRef.current = null
            }
        }

        if (skipNextSave.current) {
            skipNextSave.current = false
            return
        }

        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => {
            if (activeDoc) {
                const fullContent = getAllContent()
                performSave(activeDoc.id, fullContent)
            }
        }, 1000)

        return () => {
            if (saveTimeout.current) clearTimeout(saveTimeout.current)
        }
    }, [pages])

    // New Features State
    const fileInputRef = useRef<HTMLInputElement>(null)
    const selectionRef = useRef<Range | null>(null)
    const [selectedTable, setSelectedTable] = useState<HTMLTableElement | null>(null)
    const [selectedCell, setSelectedCell] = useState<HTMLTableCellElement | null>(null)
    const [tableToolbarPosition, setTableToolbarPosition] = useState({ top: 0, left: 0 })
    const [showColorPicker, setShowColorPicker] = useState(false)
    const docInputRef = useRef<HTMLInputElement>(null)

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setLoading(true)
            let content = ''

            if (file.type === 'application/pdf') {
                const arrayBuffer = await file.arrayBuffer()
                pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

                let extractedText = ''
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i)
                    const textContent = await page.getTextContent()
                    const operatorList = await page.getOperatorList()

                    // Improved text extraction with rich styling and layout preservation
                    const items = textContent.items as any[]
                    const styles = textContent.styles
                    // Prepare to extract images
                    const imageItems: { x: number, y: number, w: number, h: number, src: string }[] = []

                    // Iterate through operators to find images
                    const validImageOps = [
                        pdfjsLib.OPS.paintImageXObject,
                        pdfjsLib.OPS.paintXObject,
                        pdfjsLib.OPS.paintImageXObjectRepeat
                    ]

                    // Helper to get image data
                    // This is complex in pdf.js. We need to look at the dependency list.
                    // Accessing commonObjs or objs from page
                    for (let j = 0; j < operatorList.fnArray.length; j++) {
                        const fn = operatorList.fnArray[j]
                        if (validImageOps.includes(fn)) {
                            const args = operatorList.argsArray[j]
                            const imgName = args[0]
                            try {
                                // Retrieve the image object
                                page.objs.get(imgName, (img: any) => {
                                    if (img) {
                                        // We need the transform matrix to know WHERE it is
                                        // The 'dependency' operator usually sets the state
                                        // This is tricky without exact transform mapping. 
                                        // Simplified: Assume strictly sequential for now or look for 'dependency'
                                        // Better approach: Render the image to a canvas

                                        const canvas = document.createElement('canvas')
                                        canvas.width = img.width
                                        canvas.height = img.height
                                        const ctx = canvas.getContext('2d')
                                        if (ctx) {
                                            // Put image data
                                            // If it's an RGBA array
                                            if (img.data) {
                                                // data is distinct from usual ImageData for some pdfjs versions
                                                const imageData = ctx.createImageData(img.width, img.height);
                                                // simple copy if compatible, else manual
                                                if (img.kind === 2) { // ImageKind.RGB - 3 bytes/pixel
                                                    // Manual conversion
                                                    let srcOffset = 0;
                                                    let destOffset = 0;
                                                    for (let p = 0; p < img.width * img.height; p++) {
                                                        imageData.data[destOffset] = img.data[srcOffset];
                                                        imageData.data[destOffset + 1] = img.data[srcOffset + 1];
                                                        imageData.data[destOffset + 2] = img.data[srcOffset + 2];
                                                        imageData.data[destOffset + 3] = 255;
                                                        srcOffset += 3; destOffset += 4;
                                                    }
                                                } else if (img.kind === 3) { // ImageKind.RGBA
                                                    imageData.data.set(img.data)
                                                } else if (img.kind === 1) { // Grayscale
                                                    let srcOffset = 0;
                                                    let destOffset = 0;
                                                    for (let p = 0; p < img.width * img.height; p++) {
                                                        const val = img.data[srcOffset];
                                                        imageData.data[destOffset] = val;
                                                        imageData.data[destOffset + 1] = val;
                                                        imageData.data[destOffset + 2] = val;
                                                        imageData.data[destOffset + 3] = 255;
                                                        srcOffset += 1; destOffset += 4;
                                                    }
                                                }

                                                ctx.putImageData(imageData, 0, 0)
                                                const imageUrl = canvas.toDataURL()

                                                // HEURISTIC: Find the transform that applied to this image
                                                // In PDF, usually a 'cm' (concat matrix) op precedes the image paint
                                                // We scan backwards in operatorList from current 'j' index
                                                let transformIndex = j - 1;
                                                let w = img.width, h = img.height, x = 0, y = 0;
                                                // Look for nearest 'dependency' or 'transform'? 
                                                // transform is [scaleX, skewX, skewY, scaleY, translateX, translateY]
                                                while (transformIndex >= 0) {
                                                    const op = operatorList.fnArray[transformIndex]
                                                    if (op === pdfjsLib.OPS.dependency) {
                                                        // Found the dependency node, often contains the transform? No.
                                                    }
                                                    // transform matrix is usually 'cm' (concatCurrentMatrix) -> ID 23 approx?
                                                    // Actually we rely on the state. Only simpler if we assume average flow.
                                                    // Let's use a simpler approach: Just push it to a list and process later?
                                                    // Actually, without correct X/Y, we can't sort it into the text.

                                                    // Let's rely on common transform pattern: 
                                                    // q (save), cm (matrix), Do (paint XObject), Q (restore)
                                                    if (op === pdfjsLib.OPS.transform) {
                                                        const m = operatorList.argsArray[transformIndex];
                                                        // m = [scaleX, skewY, skewX, scaleY, transX, transY]
                                                        // PDF coords: Y is bottom-up.
                                                        x = m[4];
                                                        y = m[5];
                                                        // Width/Height are scaled by m[0]/m[3]
                                                        w = m[0];
                                                        h = m[3];
                                                        break; // Found it
                                                    }
                                                    transformIndex--;
                                                }

                                                imageItems.push({ x, y, w, h, src: imageUrl })
                                            }
                                        }
                                    }
                                })
                            } catch (e) {
                                console.warn("Failed to extract image", e)
                            }
                        }
                    }

                    // Combined List of Text + Images
                    const mixedItems = [
                        ...items.map(i => ({ type: 'text', ...i })),
                        ...imageItems.map(i => ({
                            type: 'image',
                            transform: [1, 0, 0, 1, i.x, i.y], // Mock transform for sorting
                            width: i.w, height: i.h,
                            str: '', // No text
                            src: i.src
                        }))
                    ]

                    if (!mixedItems.length) continue

                    // 1. Detect Layout (Single or Multi-column) and Sort
                    // Calculate basic bounds to find the 'median' of the page content
                    const xs = mixedItems.map(i => i.transform?.[4] || 0)
                    // ... (rest of logic uses mixedItems now)

                    const minX = Math.min(...xs)
                    const maxX = Math.max(...xs.map((x, idx) => x + (mixedItems[idx]?.width || 0)))
                    const midX = (minX + maxX) / 2

                    const gutterWidth = (maxX - minX) * 0.1
                    const crossingItems = mixedItems.filter(i => {
                        const x = i.transform[4]
                        const w = i.width || 0
                        return (x < midX + gutterWidth / 2) && (x + w > midX - gutterWidth / 2)
                    })

                    const isTwoColumn = (crossingItems.length < mixedItems.length * 0.2) && (mixedItems.length > 20)

                    mixedItems.sort((a, b) => { // SORT MIXED ITEMS
                        if (isTwoColumn) {
                            const colA = a.transform[4] < midX ? 0 : 1
                            const colB = b.transform[4] < midX ? 0 : 1
                            if (colA !== colB) return colA - colB
                        }
                        const yDiff = b.transform[5] - a.transform[5]
                        if (Math.abs(yDiff) < 5) return a.transform[4] - b.transform[4]
                        return yDiff
                    })

                    // Calculate page statistics for heuristics (TEXT ONLY)
                    const avgHeight = items.reduce((acc, item) => acc + (item.height || 0), 0) / items.length

                    let pageHtml = ''
                    let currentLineSegments: any[] = [] // String or Image Object
                    let currentLineY = mixedItems[0].transform[5]
                    let currentLineFirstX = mixedItems[0].transform[4]
                    let currentLineMaxHeight = 0
                    let lastItemXEnd = 0

                    const flushLine = (segments: any[], firstX: number, maxHeight: number) => {
                        if (segments.length === 0) return ''

                        // Check if line contains ONLY images
                        const images = segments.filter(s => typeof s === 'object')
                        if (images.length === segments.length) {
                            // Just output images
                            return images.map(img => `<img src="${img.src}" style="display:block; margin: 10px auto; max-width: 100%; height: auto;" />`).join('')
                        }

                        // Mixed Content
                        let html = ''
                        // Extract images to put them before/after or inline?
                        // For simplicity: Put images first, then text
                        images.forEach(img => {
                            html += `<img src="${img.src}" style="float: right; margin: 0 0 10px 10px; max-width: 200px;" />`
                        })

                        const textContent = segments.filter(s => typeof s === 'string').join('')
                        if (!textContent && !html) return ''

                        // Handle Indentation
                        const baseMargin = 45
                        const relativeX = Math.max(0, firstX - baseMargin)
                        const indentPx = Math.floor(relativeX * 1.33)

                        let pStyle = `margin: 0; line-height: 1.3; min-height: ${Math.max(12, maxHeight)}px;`
                        if (indentPx > 10) pStyle += `padding-left: ${indentPx}px;`
                        if (maxHeight > avgHeight * 1.3) pStyle += 'margin-top: 0.5em; margin-bottom: 0.25em;'

                        return `<p style="${pStyle}">${html}${textContent}</p>`
                    }

                    for (let j = 0; j < mixedItems.length; j++) {
                        const item = mixedItems[j]
                        const x = item.transform[4]
                        const y = item.transform[5]
                        const width = item.width || 0
                        const height = item.height || 0

                        if (item.type === 'image') {
                            // Treat image as a segment
                            if (Math.abs(y - currentLineY) > 20) { // Larger threshold for images
                                pageHtml += flushLine(currentLineSegments, currentLineFirstX, currentLineMaxHeight)
                                currentLineSegments = []
                                currentLineY = y
                                currentLineFirstX = x
                                currentLineMaxHeight = 0
                            }
                            currentLineSegments.push(item) // Push object
                            currentLineMaxHeight = Math.max(currentLineMaxHeight, height)
                            continue
                        }

                        // Text Item processing
                        const fontName = item.fontName
                        // Check for New Line
                        if (Math.abs(y - currentLineY) > 6) {
                            pageHtml += flushLine(currentLineSegments, currentLineFirstX, currentLineMaxHeight)
                            currentLineSegments = []
                            currentLineY = y
                            currentLineFirstX = x
                            currentLineMaxHeight = 0
                            lastItemXEnd = 0
                        }

                        // Add Space logic
                        if (currentLineSegments.length > 0 && typeof currentLineSegments[currentLineSegments.length - 1] === 'string') {
                            const gap = x - lastItemXEnd
                            if (gap > 4 && !item.str.startsWith(' ')) {
                                currentLineSegments.push(' ')
                            }
                        }

                        // Style Extraction
                        let itemStyle = ''
                        const fontObj = styles[fontName] || {}
                        let isBold = false
                        let isItalic = false

                        if (fontObj.fontFamily) {
                            const name = fontObj.fontFamily.toLowerCase()
                            if (name.includes('bold') || name.includes('black') || name.includes('heavy')) isBold = true
                            if (name.includes('italic') || name.includes('oblique')) isItalic = true
                        }

                        // Heuristic: Check font weight from font name itself if styles map is empty
                        if (fontName && (fontName.toLowerCase().includes('bold') || fontName.toLowerCase().includes('bd'))) isBold = true

                        if (isBold) itemStyle += 'font-weight: bold;'
                        if (isItalic) itemStyle += 'font-style: italic;'

                        if (height > 0) itemStyle += `font-size: ${Math.round(height)}pt;`

                        if (fontObj.fontFamily) {
                            const name = fontObj.fontFamily.toLowerCase()
                            if (name.includes('sans')) itemStyle += 'font-family: Arial, sans-serif;'
                            else if (name.includes('times') || name.includes('serif')) itemStyle += 'font-family: "Times New Roman", serif;'
                        }

                        const span = `<span style="${itemStyle}">${item.str}</span>`
                        currentLineSegments.push(span)

                        lastItemXEnd = x + width
                        currentLineMaxHeight = Math.max(currentLineMaxHeight, height)
                    }

                    // Flush last line
                    pageHtml += flushLine(currentLineSegments, currentLineFirstX, currentLineMaxHeight)

                    extractedText += pageHtml
                    if (i < pdf.numPages) extractedText += '<div class="page-break"></div>'
                }
                content = extractedText
            } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                const arrayBuffer = await file.arrayBuffer()
                const result = await mammoth.convertToHtml({ arrayBuffer })
                content = result.value
            } else {
                alert('Unsupported file type')
                setLoading(false)
                return
            }

            // Create new document with content
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                alert("Please log in.")
                setLoading(false)
                return
            }

            const { data, error } = await supabase.from('documents').insert({
                user_id: user.id,
                title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
                content: content
            }).select().single()

            if (error) throw error

            if (data) {
                setDocs(prev => [data, ...prev])
                setActiveDoc(data)
            }

        } catch (error: any) {
            console.error("Upload error:", error)
            alert("Failed to upload document")
        } finally {
            setLoading(false)
            if (docInputRef.current) docInputRef.current.value = ''
        }
    }

    // Image Resize State
    const [selectedImageWrapper, setSelectedImageWrapper] = useState<HTMLElement | null>(null)
    const [resizeOverlay, setResizeOverlay] = useState<{ top: number, left: number, width: number, height: number } | null>(null)
    const [isResizing, setIsResizing] = useState(false)
    const resizeStartRef = useRef({ x: 0, y: 0, w: 0, h: 0 })
    const activeHandleRef = useRef<string>('')

    useEffect(() => {
        const handleSelection = (e: MouseEvent) => {
            const target = e.target as HTMLElement

            const pageEl = target.closest('.document-page') as HTMLDivElement
            if (pageEl) {
                const index = pageRefs.current.indexOf(pageEl)
                if (index !== -1) setCurrentPage(index + 1)
            }

            // Ignore clicks within the toolbar to prevent losing context
            if (target.closest('.main-toolbar')) return

            // Close all dropdowns when clicking editor content
            setShowFontMenu(false)
            setShowSizeMenu(false)
            setShowHeadingMenu(false)
            setShowLineSpacing(false)
            setShowTextColorPicker(false)
            setShowHighlightColorPicker(false)

            const imageWrapper = target.closest('.resizable-image-wrapper') as HTMLElement
            if (imageWrapper) {
                setSelectedImageWrapper(imageWrapper)
                setActiveTab('image')
                const rect = imageWrapper.getBoundingClientRect()
                setResizeOverlay({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
            } else if (!target.closest('.resize-handle') && !isResizing) {
                setSelectedImageWrapper(null)
                setResizeOverlay(null)
                if (activeTab === 'image') setActiveTab('format')
            }

            const table = target.closest('table')
            const cell = target.closest('td, th')

            if (table && cell) {
                setSelectedTable(table as HTMLTableElement)
                setSelectedCell(cell as HTMLTableCellElement)
                const rect = (cell as HTMLElement).getBoundingClientRect()
                setTableToolbarPosition({
                    top: Math.max(150, rect.top - 60),
                    left: Math.max(20, Math.min(window.innerWidth - 320, rect.left))
                })
            } else if (!table && !target.closest('.table-toolbar')) {
                setSelectedTable(null)
                setSelectedCell(null)
                setShowColorPicker(false)
            }
        }

        const updateOverlay = () => {
            if (selectedImageWrapper) {
                const rect = selectedImageWrapper.getBoundingClientRect()
                setResizeOverlay({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
            }
        }

        document.addEventListener('click', handleSelection)
        document.addEventListener('scroll', updateOverlay, true)
        window.addEventListener('resize', updateOverlay)
        return () => {
            document.removeEventListener('click', handleSelection)
            document.removeEventListener('scroll', updateOverlay, true)
            window.removeEventListener('resize', updateOverlay)
        }
    }, [selectedImageWrapper, isResizing])

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (readerEvent) => {
            const result = readerEvent.target?.result as string
            if (result) {
                if (selectionRef.current) {
                    const selection = window.getSelection()
                    selection?.removeAllRanges()
                    selection?.addRange(selectionRef.current)
                }
                const html = `<div class="resizable-image-wrapper" contenteditable="false" style="display: inline-block; resize: both; overflow: hidden; vertical-align: middle; border: 1px dashed #ccc; padding: 2px; width: 100px; height: 100px; min-width: 50px; min-height: 50px;"><img src="${result}" style="width: 100%; height: 100%; object-fit: contain; pointer-events: none;" /></div><p><br></p>`
                document.execCommand('insertHTML', false, html)
            }
        }
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    const handlePaste = (e: React.ClipboardEvent, index: number) => {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault()
                const blob = items[i].getAsFile()
                if (!blob) continue
                const reader = new FileReader()
                reader.onload = (event) => {
                    const result = event.target?.result as string
                    const html = `<div class="resizable-image-wrapper" contenteditable="false" style="display: inline-block; resize: both; overflow: hidden; vertical-align: middle; border: 1px dashed #ccc; padding: 2px; width: 100px; height: 100px; min-width: 50px; min-height: 50px;"><img src="${result}" style="width: 100%; height: 100%; object-fit: contain; pointer-events: none;" /></div><p><br></p>`
                    document.execCommand('insertHTML', false, html)
                    // Trigger save
                    pageRefs.current[index]?.dispatchEvent(new Event('input', { bubbles: true }))
                }
                reader.readAsDataURL(blob)
                return
            }
        }
    }

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing || !selectedImageWrapper) return
            e.preventDefault()

            const dx = e.clientX - resizeStartRef.current.x
            const dy = e.clientY - resizeStartRef.current.y

            let newWidth = resizeStartRef.current.w
            let newHeight = resizeStartRef.current.h

            if (activeHandleRef.current.includes('e')) newWidth += dx
            if (activeHandleRef.current.includes('w')) newWidth -= dx
            if (activeHandleRef.current.includes('s')) newHeight += dy
            if (activeHandleRef.current.includes('n')) newHeight -= dy

            newWidth = Math.max(50, newWidth)
            newHeight = Math.max(50, newHeight)

            selectedImageWrapper.style.width = `${newWidth}px`
            selectedImageWrapper.style.height = `${newHeight}px`

            const rect = selectedImageWrapper.getBoundingClientRect()
            setResizeOverlay({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
        }

        const handleMouseUp = () => {
            if (isResizing) {
                setIsResizing(false)
                selectedImageWrapper?.closest('.document-page')?.dispatchEvent(new Event('input', { bubbles: true }))
            }
        }

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing, selectedImageWrapper])

    const initResize = (e: React.MouseEvent, handle: string) => {
        e.preventDefault()
        e.stopPropagation()
        if (!selectedImageWrapper) return

        setIsResizing(true)
        activeHandleRef.current = handle
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            w: selectedImageWrapper.offsetWidth,
            h: selectedImageWrapper.offsetHeight
        }
    }

    useEffect(() => {
        fetchDocs()
    }, [])





    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setShowFontMenu(false)
            setShowSizeMenu(false)
            setShowHeadingMenu(false)
            setShowLineSpacing(false)
        }
        if (showFontMenu || showSizeMenu || showHeadingMenu || showLineSpacing) {
            document.addEventListener('click', handleClickOutside)
            return () => document.removeEventListener('click', handleClickOutside)
        }
    }, [showFontMenu, showSizeMenu, showHeadingMenu, showLineSpacing])

    // Auto-focus next page if needed
    // Auto-focus page if requested
    useEffect(() => {
        if (focusRequestRef.current && pageRefs.current[focusRequestRef.current.index]) {
            const { index, position } = focusRequestRef.current
            const pageEl = pageRefs.current[index]
            if (pageEl) {
                pageEl.focus()

                if (position === 'start') {
                    // Place cursor at start
                    if (pageEl.firstChild) {
                        const range = document.createRange()
                        range.setStart(pageEl.firstChild, 0)
                        range.collapse(true)
                        const selection = window.getSelection()
                        selection?.removeAllRanges()
                        selection?.addRange(range)
                    }
                } else {
                    // Place cursor at END (for backspace navigation)
                    const range = document.createRange()
                    range.selectNodeContents(pageEl)
                    range.collapse(false)
                    const selection = window.getSelection()
                    selection?.removeAllRanges()
                    selection?.addRange(range)
                }
            }
            focusRequestRef.current = null
        }
    }, [pages.length])

    const applyFont = (font: string) => {
        document.execCommand('fontName', false, font)
        setFontFamily(font)
    }

    const applyFontSize = (size: string) => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return

        // Simple approach: wrap in span
        // For robustness, usually we'd use a rich text lib, but here we manipulate DOM
        const range = selection.getRangeAt(0)

        if (selection.isCollapsed) {
            // Insert empty span with invisible char to type into
            const span = document.createElement('span')
            span.style.fontSize = size + 'pt'
            span.innerHTML = '&#8203;' // Zero width space
            range.insertNode(span)

            // Move cursor inside span
            range.setStart(span.firstChild!, 1)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
        } else {
            const span = document.createElement('span')
            span.style.fontSize = size + 'pt'

            try {
                // Try surroundContents - works if valid HTML structure
                range.surroundContents(span)
            } catch (e) {
                // Fallback: extract and insert (might break some nested tags but safe)
                const content = range.extractContents()
                span.appendChild(content)
                range.insertNode(span)
            }
        }
        setFontSize(size)
    }

    const applyLineHeight = (height: string) => {
        const selection = window.getSelection()
        if (!selection || selection.rangeCount === 0) return

        const range = selection.getRangeAt(0)
        const span = document.createElement('span')
        span.style.lineHeight = height
        span.style.display = 'inline-block'

        if (selection.isCollapsed) {
            span.innerHTML = '&#8203;'
            range.insertNode(span)
            range.setStart(span.firstChild!, 1)
            range.collapse(true)
            selection.removeAllRanges()
            selection.addRange(range)
        } else {
            try {
                // Try surroundContents
                range.surroundContents(span)
            } catch (e) {
                const content = range.extractContents()
                span.appendChild(content)
                range.insertNode(span)
            }
        }
        setLineHeight(height)
    }

    const fetchDocs = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data } = await supabase
            .from('documents')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })

        if (data) setDocs(data)
        setLoading(false)
    }

    const createDoc = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                alert("Please log in to create documents.")
                return
            }

            const { data, error } = await supabase.from('documents').insert({
                user_id: user.id,
                title: 'Untitled Document',
                content: '<p>Start writing...</p>'
            }).select().single()

            if (error) throw error

            if (data) {
                setDocs(prev => [data, ...prev])
                lastSavedId.current = null
                setActiveDoc(data)
            }
        } catch (error: any) {
            console.error("Error creating document:", error)
            alert(`Failed to create document: ${error.message}`)
        }
    }

    const performSave = async (id: string, content: string, title?: string) => {
        setIsSaving(true)
        const updates: any = { content }
        if (title !== undefined) updates.title = title

        const { error } = await supabase.from('documents').update(updates).eq('id', id)
        if (error) console.error("Auto-save error:", error)

        setDocs(prev => prev.map(d => d.id === id ? { ...d, ...updates, updated_at: new Date().toISOString() } : d))
        setTimeout(() => setIsSaving(false), 800)
    }

    const getAllContent = () => {
        // Join with delimiter for persistence, only including active pages
        return pageRefs.current
            .slice(0, pages.length)
            .map(el => el ? el.innerHTML : '')
            .join('<div class="page-break"></div>')
    }

    const getPagesFromDOM = () => {
        return pageRefs.current.slice(0, pages.length).map(el => el?.innerHTML || '')
    }

    // Helper to check overflow
    const checkOverflow = useCallback((target: HTMLElement) => {
        // Standard overflow check (content > height)
        if (target.scrollHeight > target.clientHeight) return true

        // Visual overflow check (content > height - margin)
        // Ensure we respect the bottom margin
        const rect = target.getBoundingClientRect()
        // If we have children, check the last one
        if (target.lastChild) {
            const lastNode = target.lastChild
            let lastBottom = 0

            if (lastNode.nodeType === Node.ELEMENT_NODE) {
                lastBottom = (lastNode as Element).getBoundingClientRect().bottom
            } else {
                const range = document.createRange()
                range.selectNode(lastNode)
                lastBottom = range.getBoundingClientRect().bottom
            }

            // Allow a small buffer (2px)
            const limit = rect.bottom - (pageSettings.marginBottom || 96) + 2

            if (lastBottom > limit) return true
        }

        return false
    }, [pageSettings.marginBottom])

    // State to trigger pagination on input
    const [lastInputTime, setLastInputTime] = useState(Date.now())

    // Auto-Pagination Effect
    useEffect(() => {
        let isPaginating = false

        const paginate = () => {
            if (isPaginating) return
            isPaginating = true

            let changed = false
            // Use current refs, but filtered for existence
            const currentRefs = [...pageRefs.current].filter(Boolean)

            for (let i = 0; i < currentRefs.length; i++) {
                const pageEl = currentRefs[i] as HTMLDivElement

                if (checkOverflow(pageEl)) {
                    // Move content to next page
                    const nodesToMove: Node[] = []
                    while (checkOverflow(pageEl) && pageEl.lastChild) {
                        const node = pageEl.lastChild
                        pageEl.removeChild(node)
                        nodesToMove.unshift(node)
                    }

                    if (nodesToMove.length > 0) {
                        // Check if next page exists in DOM
                        const nextPageEl = currentRefs[i + 1]

                        if (nextPageEl) {
                            // Prepend to next page
                            // Create range/selection restoration logic if needed, but for bulk flow:
                            if (nextPageEl.firstChild) {
                                nodesToMove.forEach(node => nextPageEl.insertBefore(node, nextPageEl.firstChild))
                            } else {
                                nodesToMove.forEach(node => nextPageEl.appendChild(node))
                            }
                            // Mark changed to sync state
                            changed = true
                        } else {
                            // Creating a new page logic.

                            // CRITICAL FIX: Prevent Infinite Loop
                            // If we moved ALL content from the current page (it is now empty), 
                            // and we are about to put it onto a new page, we are just shifting the overflow problem 
                            // to a new page, which will then trigger creation of another page, ad infinitum.
                            // This happens if a single element is larger than the page body.

                            if (!pageEl.firstChild) {
                                // Put it back. We cannot split this content further.
                                nodesToMove.forEach(node => pageEl.appendChild(node))
                                // Break the loop for this page.
                            } else {
                                // Create new page content
                                const tempDiv = document.createElement('div')
                                nodesToMove.forEach(node => tempDiv.appendChild(node))

                                // We need to trigger a state update to add this new page
                                const allContent = currentRefs.map(el => el!.innerHTML)
                                allContent.push(tempDiv.innerHTML)

                                setPages(allContent)
                                return // Exit loop to allow re-render
                            }
                        }
                    }
                }
            }

            // 2. Check for Underflow / Empty Pages (Reverse Flow Cleanup)
            // If a page is visually empty and it's not the only page, remove it.
            // We scan backwards to safely remove from end.
            for (let i = currentRefs.length - 1; i > 0; i--) {
                const pageEl = currentRefs[i] as HTMLDivElement
                // Strict empty check: no text, no images/tables/hr
                const isVisuallyEmpty = !pageEl.innerText.trim() && !pageEl.querySelector('img') && !pageEl.querySelector('table') && !pageEl.querySelector('hr')

                if (isVisuallyEmpty) {
                    // Remove this page from state
                    const allContent = currentRefs.map(el => el!.innerHTML)
                    allContent.splice(i, 1) // Remove at index i
                    setPages(allContent)
                    return // Exit loop to trigger re-render
                }
            }

            // If we just moved content between existing pages, we need to sync state
            if (changed) {
                const allContent = currentRefs.map(el => el!.innerHTML)
                setPages(allContent)
            }
            isPaginating = false
        }

        // Debounce pagination to avoid UI freezing
        const timeout = setTimeout(paginate, 500)
        return () => clearTimeout(timeout)
    }, [pages, checkOverflow, lastInputTime]) // Run when pages change OR user types

    const handlePageInput = (pageIndex: number, e: React.FormEvent<HTMLDivElement>) => {
        setCurrentPage(pageIndex + 1)
        checkActiveFormats()
        if (!activeDoc) return

        // Trigger pagination check shortly after input
        setLastInputTime(Date.now())

        const target = e.currentTarget

        // Check for empty page deletion
        // Enforce strict: if page is empty (and not first), remove it.
        const isVisuallyEmpty = !target.innerText.trim() && !target.querySelector('img') && !target.querySelector('table') && !target.querySelector('hr')

        if (pages.length > 1 && isVisuallyEmpty) {
            // Delete this page
            const currentPages = getPagesFromDOM()
            const newPages = currentPages.filter((_, i) => i !== pageIndex)

            setPages(newPages)
            focusRequestRef.current = { index: pageIndex - 1, position: 'end' }
            return
        }

        if (saveTimeout.current) clearTimeout(saveTimeout.current)

        saveTimeout.current = setTimeout(() => {
            // Join all pages for storage from DOM
            const fullContent = getAllContent()
            performSave(activeDoc.id, fullContent)
        }, 1000)
    }

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Backspace') {
            const pageEl = pageRefs.current[index]

            // Allow deleting empty pages
            // Check if visually empty
            const isVisuallyEmpty = pageEl && !pageEl.innerText.trim() && !pageEl.querySelector('img') && !pageEl.querySelector('table') && !pageEl.querySelector('hr')

            if (index > 0 && isVisuallyEmpty) {
                e.preventDefault()
                const newPages = pages.filter((_, i) => i !== index)
                setPages(newPages)
                focusRequestRef.current = { index: index - 1, position: 'end' }
                return
            }
        }

        if (e.key === 'Enter') {
            const selection = window.getSelection()
            if (!selection?.rangeCount) return

            const range = selection.getRangeAt(0)
            const node = range.startContainer

            // 1. Check for Custom Checklist (Label)
            let currentLabel: HTMLElement | null = null
            let walker: Node | null = node

            // Traverse up looking for LABEL or stopping at Page boundary
            while (walker && walker.nodeName !== 'BODY') {
                if (walker.nodeType === Node.ELEMENT_NODE) {
                    const el = walker as HTMLElement
                    if (el.classList.contains('document-page')) break

                    if (el.nodeName === 'LABEL' && el.querySelector('input[type="checkbox"]')) {
                        currentLabel = el
                        break
                    }
                }
                walker = walker.parentNode
            }


            if (currentLabel) {
                e.preventDefault()
                const span = currentLabel.querySelector('span')
                const text = span?.innerText.replace(/[\u200B\n]/g, '').trim()

                if (!text) {
                    // Empty item -> Exit list (Convert to Paragraph)
                    const p = document.createElement('p')
                    p.innerHTML = '<br>'
                    currentLabel.replaceWith(p)

                    const newRange = document.createRange()
                    newRange.setStart(p, 0)
                    newRange.collapse(true)
                    selection.removeAllRanges()
                    selection.addRange(newRange)
                } else {
                    // New Checklist Item
                    const newItem = currentLabel.cloneNode(true) as HTMLElement
                    const newSpan = newItem.querySelector('span')
                    const newInput = newItem.querySelector('input')

                    if (newSpan) newSpan.innerHTML = '&#8203;' // Zero-width space
                    if (newInput) newInput.checked = false // Uncheck

                    if (currentLabel.nextSibling) {
                        currentLabel.parentNode?.insertBefore(newItem, currentLabel.nextSibling)
                    } else {
                        currentLabel.parentNode?.appendChild(newItem)
                    }

                    // Focus new item
                    if (newSpan) {
                        const newRange = document.createRange()
                        // Focus on the text node inside span if possible
                        newRange.setStart(newSpan.firstChild || newSpan, newSpan.firstChild ? 1 : 0)
                        newRange.collapse(true)
                        selection.removeAllRanges()
                        selection.addRange(newRange)
                    }
                }
                return
            }

            // 2. Check for Standard List (LI)
            let current: Node | null = node
            while (current && current.nodeName !== 'LI' && current.nodeName !== 'DIV' && !(current as HTMLElement).classList?.contains('document-page')) {
                current = current.parentNode
            }

            if (current && current.nodeName === 'LI') {
                const li = current as HTMLLIElement
                const text = li.innerText.replace(/[\u200B\n]/g, '').trim()

                if (!text) {
                    e.preventDefault()
                    document.execCommand('outdent')
                }
            }
        }
    }

    const handleTitleChange = (newTitle: string) => {
        if (!activeDoc) return
        setActiveDoc({ ...activeDoc, title: newTitle })

        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => {
            const fullContent = getAllContent()
            performSave(activeDoc.id, fullContent, newTitle)
        }, 1000)
    }

    const deleteDoc = async (id: string) => {
        if (!confirm('Are you sure you want to delete this document?')) return
        await supabase.from('documents').delete().eq('id', id)
        setDocs(prev => prev.filter(d => d.id !== id))
        if (activeDoc?.id === id) setActiveDoc(null)
    }

    const execCommand = (command: string, value?: string) => {
        document.execCommand(command, false, value)
        checkActiveFormats()
        // Focus the first page if lost? Or keep current focus
        // Trigger save
        if (saveTimeout.current) clearTimeout(saveTimeout.current)
        saveTimeout.current = setTimeout(() => {
            const fullContent = getAllContent()
            performSave(activeDoc?.id || '', fullContent)
        }, 1000)
    }

    const insertTable = () => {
        const rows = prompt('Number of rows:', '3')
        const cols = prompt('Number of columns:', '3')
        if (!rows || !cols) return

        let tableHtml = '<table style="border-collapse: collapse; width: 100%; table-layout: fixed; margin: 20px 0; border: 1px solid #333;">'
        for (let i = 0; i < parseInt(rows); i++) {
            tableHtml += '<tr>'
            for (let j = 0; j < parseInt(cols); j++) {
                tableHtml += '<td style="border: 1px solid #666; padding: 12px; min-width: 40px; min-height: 30px; word-break: break-word;">&nbsp;</td>'
            }
            tableHtml += '</tr>'
        }
        tableHtml += '</table><p><br></p>'
        execCommand('insertHTML', tableHtml)
    }

    const insertImage = () => {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
            selectionRef.current = selection.getRangeAt(0)
        }
        fileInputRef.current?.click()
    }

    const insertLink = () => {
        const url = prompt('Enter URL:')
        if (url) {
            execCommand('createLink', url)
        }
    }

    const insertPageBreak = () => {
        execCommand('insertHTML', '<div class="page-break" style="page-break-after: always; margin: 40px 0; border-top: 3px dashed #999; padding-top: 40px; clear: both;"><hr style="border: none; border-top: 1px dashed #ccc; margin: 20px 0;"/></div>')
    }

    const applyHeading = (tag: string) => {
        execCommand('formatBlock', tag)
        setShowHeadingMenu(false)
    }

    const handleFind = () => {
        if (!findText) return
        (window as any).find(findText)
    }

    const handleReplace = () => {
        if (!findText || !replaceText || !pageRefs.current[0]) return
        // Only finding in first page for now for simplicity in v1
        const content = pageRefs.current[0].innerHTML
        const newContent = content.replace(new RegExp(findText, 'gi'), replaceText)
        pageRefs.current[0].innerHTML = newContent

        // Force update pages state from DOM to keep success
        const currentPages = getPagesFromDOM()
        currentPages[0] = newContent
        setPages(currentPages)
    }

    const handlePrint = () => {
        if (!activeDoc) return
        const { marginTop, marginBottom, marginLeft, marginRight, pageColor } = pageSettings
        const printContent = `
            <html>
                <head>
                    <title>${activeDoc.title || 'Document'}</title>
                    <style>
                        @page { 
                            size: ${pageSettings.size === 'a4' ? 'A4' : 'Letter'} ${pageSettings.orientation}; 
                            margin: ${marginTop * 0.264583}mm ${marginRight * 0.264583}mm ${marginBottom * 0.264583}mm ${marginLeft * 0.264583}mm; 
                        }
                        body { 
                            font-family: ${fontFamily}, serif; 
                            line-height: ${lineHeight}; 
                            color: #000;
                            padding: 0;
                            margin: 0;
                            background-color: ${pageColor};
                        }
                        .page-break {
                            page-break-after: always;
                            border: none !important;
                        }
                        /* ... existing styles ... */
                        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
                        td, th { border: 1px solid #333; padding: 8px; }
                        img { max-width: 100%; height: auto; }
                    </style>
                </head>
                <body>
                    ${pages.join('<div class="page-break"></div>')}
                </body>
            </html>
        `
        const printWindow = window.open('', '', 'width=800,height=600')
        if (printWindow) {
            printWindow.document.write(printContent)
            printWindow.document.close()
            printWindow.focus()
            setTimeout(() => {
                printWindow.print()
            }, 500)
        }
    }

    const handleDownloadDoc = () => {
        if (!activeDoc) return

        const preHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${activeDoc.title}</title><style>
            body { font-family: '${fontFamily}'; font-size: ${fontSize}pt; }
        </style></head><body>`
        const postHtml = "</body></html>"

        const content = pages.join('<br style="page-break-before: always">')

        const html = preHtml + content + postHtml

        const blob = new Blob(['\ufeff', html], {
            type: 'application/msword'
        });

        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement("a");
        document.body.appendChild(downloadLink);
        downloadLink.href = url;
        downloadLink.download = `${activeDoc.title || 'document'}.doc`;
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    }

    const fonts = ['Arial', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Comic Sans MS', 'Trebuchet MS', 'Impact', 'Palatino', 'Garamond']
    const fontSizes = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '28', '32', '36', '40', '48', '60', '72']
    const lineSpacings = ['1.0', '1.15', '1.5', '1.75', '2.0', '2.5', '3.0']

    if (activeDoc) {
        const pageWidth = pageSettings.size === 'a4' ?
            (pageSettings.orientation === 'portrait' ? 816 : 1056) :
            (pageSettings.orientation === 'portrait' ? 816 : 1056)

        return (
            <div className="flex flex-col h-full bg-[#e8e8e8] relative overflow-hidden">
                {/* Find & Replace Modal */}
                {showFindReplace && (
                    <div className="fixed top-20 right-8 bg-[var(--bg-surface)] shadow-2xl rounded-xl p-5 z-[100] border-2 border-[var(--accent-espresso)]/20 w-96">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-base">Find & Replace</h3>
                            <button onClick={() => setShowFindReplace(false)} className="p-1.5 hover:bg-[var(--accent-espresso)]/10 rounded-full transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <input
                            type="text"
                            placeholder="Find"
                            value={findText}
                            onChange={(e) => setFindText(e.target.value)}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg mb-3 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <input
                            type="text"
                            placeholder="Replace with"
                            value={replaceText}
                            onChange={(e) => setReplaceText(e.target.value)}
                            className="w-full p-3 border-2 border-gray-300 rounded-lg mb-4 text-sm focus:border-blue-500 focus:outline-none"
                        />
                        <div className="flex gap-3">
                            <button onClick={handleFind} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                                Find Next
                            </button>
                            <button onClick={handleReplace} className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">
                                Replace All
                            </button>
                        </div>
                    </div>
                )}

                {/* Page Settings Modal */}
                {showPageSettings && (
                    <div className="fixed top-20 right-8 bg-[var(--bg-surface)] shadow-2xl rounded-xl p-5 z-[100] border-2 border-[var(--accent-espresso)]/20 w-96 max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-base">Page Setup</h3>
                            <button onClick={() => setShowPageSettings(false)} className="p-1.5 hover:bg-[var(--accent-espresso)]/10 rounded-full transition-colors">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-2">Page Size</label>
                                <select
                                    value={pageSettings.size}
                                    onChange={(e) => setPageSettings(prev => ({ ...prev, size: e.target.value as any }))}
                                    className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="a4">A4 (210 × 297 mm)</option>
                                    <option value="letter">Letter (8.5 × 11 in)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-2">Orientation</label>
                                <select
                                    value={pageSettings.orientation}
                                    onChange={(e) => setPageSettings(prev => ({ ...prev, orientation: e.target.value as any }))}
                                    className="w-full p-3 border-2 border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="portrait">Portrait</option>
                                    <option value="landscape">Landscape</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-2">Margins (pixels)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1">Top</label>
                                        <input
                                            type="number"
                                            value={pageSettings.marginTop}
                                            onChange={(e) => setPageSettings(prev => ({ ...prev, marginTop: parseInt(e.target.value) || 0 }))}
                                            className="w-full p-2 border-2 border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1">Bottom</label>
                                        <input
                                            type="number"
                                            value={pageSettings.marginBottom}
                                            onChange={(e) => setPageSettings(prev => ({ ...prev, marginBottom: parseInt(e.target.value) || 0 }))}
                                            className="w-full p-2 border-2 border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1">Left</label>
                                        <input
                                            type="number"
                                            value={pageSettings.marginLeft}
                                            onChange={(e) => setPageSettings(prev => ({ ...prev, marginLeft: parseInt(e.target.value) || 0 }))}
                                            className="w-full p-2 border-2 border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-gray-500 block mb-1">Right</label>
                                        <input
                                            type="number"
                                            value={pageSettings.marginRight}
                                            onChange={(e) => setPageSettings(prev => ({ ...prev, marginRight: parseInt(e.target.value) || 0 }))}
                                            className="w-full p-2 border-2 border-gray-300 rounded text-sm focus:border-blue-500 focus:outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-700 block mb-2">Page Background Color</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="color"
                                        value={pageSettings.pageColor}
                                        onChange={(e) => setPageSettings(prev => ({ ...prev, pageColor: e.target.value }))}
                                        className="w-16 h-12 border-2 border-gray-300 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={pageSettings.pageColor}
                                        onChange={(e) => setPageSettings(prev => ({ ...prev, pageColor: e.target.value }))}
                                        className="flex-1 p-2 border-2 border-gray-300 rounded text-sm font-mono focus:border-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Toolbar */}
                <div className="main-toolbar bg-[var(--bg-surface)] border-b-2 border-[var(--accent-espresso)] p-3 flex flex-col gap-2 shrink-0 shadow-md z-20 sticky top-0">
                    {/* Top Row */}
                    <div className="flex items-center gap-3 px-2">
                        <button onClick={() => setActiveDoc(null)} className="p-2 hover:bg-[var(--accent-espresso)]/10 rounded-lg text-[var(--accent-espresso)] transition-colors border border-transparent hover:border-[var(--accent-espresso)]/20">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <input
                                    className="bg-transparent font-semibold text-[var(--accent-espresso)] focus:outline-none focus:bg-[var(--accent-espresso)]/10 px-2 py-1 rounded-md text-base w-full max-w-[400px] border-2 border-transparent focus:border-[var(--accent-espresso)]/50 transition-all"
                                    value={activeDoc.title}
                                    onChange={(e) => handleTitleChange(e.target.value)}
                                    placeholder="Untitled Document"
                                />
                                {isSaving && <div className="flex items-center gap-2 ml-2 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-[11px] text-green-700 font-bold uppercase tracking-wide">Saved</span>
                                </div>}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-espresso)] text-[var(--bg-cream)] rounded-lg hover:bg-[var(--accent-espresso)]/90 transition-all text-sm font-bold active:scale-95 shadow-md">
                                <Printer size={18} /> Print
                            </button>
                            <button onClick={handleDownloadDoc} className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-espresso)] text-[var(--bg-cream)] rounded-lg hover:bg-[var(--accent-espresso)]/90 transition-all text-sm font-bold active:scale-95 shadow-md">
                                <FileText size={18} /> Docs
                            </button>
                            <button onClick={() => handlePrint()} className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-espresso)] text-[var(--bg-cream)] rounded-lg hover:bg-[var(--accent-espresso)]/90 transition-all text-sm font-bold active:scale-95 shadow-md">
                                <Download size={18} /> PDF
                            </button>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center gap-1 px-2 border-t border-gray-200 pt-2">
                        <button
                            onClick={() => setActiveTab('format')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'format' ? 'bg-[var(--accent-peach)] text-[var(--accent-espresso)] border-2 border-[var(--accent-espresso)]' : 'text-[var(--accent-espresso)]/70 hover:bg-[var(--bg-cream)] border-2 border-transparent'}`}
                        >
                            Format
                        </button>
                        <button
                            onClick={() => setActiveTab('insert')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'insert' ? 'bg-[var(--accent-peach)] text-[var(--accent-espresso)] border-2 border-[var(--accent-espresso)]' : 'text-[var(--accent-espresso)]/70 hover:bg-[var(--bg-cream)] border-2 border-transparent'}`}
                        >
                            Insert
                        </button>
                        <button
                            onClick={() => setActiveTab('layout')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'layout' ? 'bg-[var(--accent-peach)] text-[var(--accent-espresso)] border-2 border-[var(--accent-espresso)]' : 'text-[var(--accent-espresso)]/70 hover:bg-[var(--bg-cream)] border-2 border-transparent'}`}
                        >
                            Layout
                        </button>
                        {selectedTable && (
                            <button
                                onClick={() => setActiveTab('table')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'table' ? 'bg-purple-100 text-purple-700 border-2 border-purple-300' : 'text-purple-600 hover:bg-purple-50 border-2 border-transparent'}`}
                            >
                                Table Design
                            </button>
                        )}
                        {selectedImageWrapper && (
                            <button
                                onClick={() => setActiveTab('image')}
                                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'image' ? 'bg-orange-100 text-orange-700 border-2 border-orange-300' : 'text-orange-600 hover:bg-orange-50 border-2 border-transparent'}`}
                            >
                                Image Tools
                            </button>
                        )}
                    </div>

                    {/* Tab Content - Wrapping toolbar */}
                    <div className="flex items-center gap-2 px-2 pb-1 flex-wrap">
                        {/* FORMAT TAB */}
                        {activeTab === 'format' && (
                            <>
                                {/* Undo/Redo */}
                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm">
                                    <button
                                        onClick={() => execCommand('undo')}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border border-transparent hover:border-[var(--accent-espresso)]/30"
                                        title="Undo (Ctrl+Z)"
                                    >
                                        <Undo size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => execCommand('redo')}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border border-transparent hover:border-[var(--accent-espresso)]/30"
                                        title="Redo (Ctrl+Y)"
                                    >
                                        <Redo size={18} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* Font Family */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setShowFontMenu(!showFontMenu)
                                            setShowSizeMenu(false)
                                            setShowHeadingMenu(false)
                                            setShowLineSpacing(false)
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--accent-espresso)]/5 rounded-lg border-2 border-[var(--accent-espresso)] text-sm font-medium shadow-sm min-w-[140px] text-[var(--accent-espresso)]"
                                    >
                                        <Type size={16} />
                                        <span className="flex-1 truncate text-left">{fontFamily}</span>
                                        <ChevronDown size={16} />
                                    </button>
                                    {showFontMenu && (
                                        <div className="absolute top-full mt-2 bg-[var(--bg-surface)] shadow-2xl rounded-lg border-2 border-[var(--accent-espresso)] z-[60] w-56 max-h-80 overflow-auto">
                                            {fonts.map(font => (
                                                <button
                                                    key={font}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        applyFont(font)
                                                        setShowFontMenu(false)
                                                    }}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    className="w-full text-left px-4 py-3 hover:bg-[var(--accent-espresso)]/5 text-sm border-b border-[var(--accent-espresso)]/10 last:border-0 font-medium transition-colors text-[var(--accent-espresso)]"
                                                    style={{ fontFamily: font }}
                                                >
                                                    {font}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Font Size */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setShowSizeMenu(!showSizeMenu)
                                            setShowFontMenu(false)
                                            setShowHeadingMenu(false)
                                            setShowLineSpacing(false)
                                            setShowTextColorPicker(false)
                                            setShowHighlightColorPicker(false)
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--accent-espresso)]/5 rounded-lg border-2 border-[var(--accent-espresso)] text-sm font-bold shadow-sm min-w-[80px] text-[var(--accent-espresso)]"
                                    >
                                        <span className="font-mono flex-1">{fontSize}pt</span>
                                        <ChevronDown size={16} />
                                    </button>
                                    {showSizeMenu && (
                                        <div className="absolute top-full mt-2 bg-[var(--bg-surface)] shadow-2xl rounded-lg border-2 border-[var(--accent-espresso)] z-[60] w-28 max-h-80 overflow-auto">
                                            {fontSizes.map(size => (
                                                <button
                                                    key={size}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        applyFontSize(size)
                                                        setShowSizeMenu(false)
                                                    }}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    className="w-full text-left px-4 py-2.5 hover:bg-[var(--accent-espresso)]/5 text-sm font-mono font-bold border-b border-[var(--accent-espresso)]/10 last:border-0 transition-colors text-[var(--accent-espresso)]"
                                                >
                                                    {size}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Heading Styles */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setShowHeadingMenu(!showHeadingMenu)
                                            setShowFontMenu(false)
                                            setShowSizeMenu(false)
                                            setShowLineSpacing(false)
                                            setShowTextColorPicker(false)
                                            setShowHighlightColorPicker(false)
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--accent-espresso)]/5 rounded-lg border-2 border-[var(--accent-espresso)] text-sm font-semibold shadow-sm min-w-[100px] text-[var(--accent-espresso)]"
                                    >
                                        <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{currentBlockType}</span>
                                        <ChevronDown size={16} />
                                    </button>
                                    {showHeadingMenu && (
                                        <div className="absolute top-full mt-2 bg-[var(--bg-surface)] shadow-2xl rounded-lg border-2 border-[var(--accent-espresso)] z-[60] w-52 text-[var(--accent-espresso)]">
                                            <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); applyHeading('p'); }} className="w-full text-left px-4 py-3 hover:bg-[var(--accent-espresso)]/5 text-sm border-b border-[var(--accent-espresso)]/10 transition-colors">Normal Text</button>
                                            <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); applyHeading('h1'); }} className="w-full text-left px-4 py-3 hover:bg-[var(--accent-espresso)]/5 text-2xl font-bold border-b border-[var(--accent-espresso)]/10 transition-colors">Heading 1</button>
                                            <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); applyHeading('h2'); }} className="w-full text-left px-4 py-3 hover:bg-[var(--accent-espresso)]/5 text-xl font-bold border-b border-[var(--accent-espresso)]/10 transition-colors">Heading 2</button>
                                            <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); applyHeading('h3'); }} className="w-full text-left px-4 py-3 hover:bg-[var(--accent-espresso)]/5 text-lg font-bold border-b border-[var(--accent-espresso)]/10 transition-colors">Heading 3</button>
                                            <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); applyHeading('h4'); }} className="w-full text-left px-4 py-3 hover:bg-[var(--accent-espresso)]/5 text-base font-bold border-b border-[var(--accent-espresso)]/10 transition-colors">Heading 4</button>
                                            <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); applyHeading('h5'); }} className="w-full text-left px-4 py-3 hover:bg-[var(--accent-espresso)]/5 text-sm font-bold border-b border-[var(--accent-espresso)]/10 transition-colors">Heading 5</button>
                                            <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); applyHeading('h6'); }} className="w-full text-left px-4 py-3 hover:bg-[var(--accent-espresso)]/5 text-xs font-bold transition-colors">Heading 6</button>
                                        </div>
                                    )}
                                </div>

                                {/* Text Formatting */}
                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm gap-0.5">
                                    <button
                                        onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
                                        className={`p-2 px-3 rounded-md transition-all border-2 ${activeFormats.bold ? 'bg-[var(--accent-espresso)] text-[var(--bg-cream)] border-[var(--accent-espresso)] shadow-md' : 'hover:bg-[var(--bg-surface)] text-[var(--accent-espresso)] border-transparent'}`}
                                        title="Bold (Ctrl+B)"
                                    >
                                        <Bold size={18} strokeWidth={3} />
                                    </button>
                                    <button
                                        onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }}
                                        className={`p-2 px-3 rounded-md transition-all border-2 ${activeFormats.italic ? 'bg-[var(--accent-espresso)] text-[var(--bg-cream)] border-[var(--accent-espresso)] shadow-md' : 'hover:bg-[var(--bg-surface)] text-[var(--accent-espresso)] border-transparent'}`}
                                        title="Italic (Ctrl+I)"
                                    >
                                        <Italic size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }}
                                        className={`p-2 px-3 rounded-md transition-all border-2 ${activeFormats.underline ? 'bg-[var(--accent-espresso)] text-[var(--bg-cream)] border-[var(--accent-espresso)] shadow-md' : 'hover:bg-[var(--bg-surface)] text-[var(--accent-espresso)] border-transparent'}`}
                                        title="Underline (Ctrl+U)"
                                    >
                                        <UnderlineIcon size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onMouseDown={(e) => { e.preventDefault(); execCommand('strikeThrough'); }}
                                        className={`p-2 px-3 rounded-md transition-all border-2 ${activeFormats.strikethrough ? 'bg-[var(--accent-espresso)] text-[var(--bg-cream)] border-[var(--accent-espresso)] shadow-md' : 'hover:bg-[var(--bg-surface)] text-[var(--accent-espresso)] border-transparent'}`}
                                        title="Strikethrough"
                                    >
                                        <Strikethrough size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onMouseDown={(e) => { e.preventDefault(); execCommand('superscript'); }}
                                        className={`p-2 px-3 rounded-md transition-all border-2 ${activeFormats.superscript ? 'bg-[var(--accent-espresso)] text-[var(--bg-cream)] border-[var(--accent-espresso)] shadow-md' : 'hover:bg-[var(--bg-surface)] text-[var(--accent-espresso)] border-transparent'}`}
                                        title="Superscript"
                                    >
                                        <Superscript size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onMouseDown={(e) => { e.preventDefault(); execCommand('subscript'); }}
                                        className={`p-2 px-3 rounded-md transition-all border-2 ${activeFormats.subscript ? 'bg-[var(--accent-espresso)] text-[var(--bg-cream)] border-[var(--accent-espresso)] shadow-md' : 'hover:bg-[var(--bg-surface)] text-[var(--accent-espresso)] border-transparent'}`}
                                        title="Subscript"
                                    >
                                        <Subscript size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onMouseDown={(e) => { e.preventDefault(); execCommand('removeFormat'); }}
                                        className="p-2 px-3 rounded-md hover:bg-red-100/10 text-red-400 border-2 border-transparent transition-all"
                                        title="Clear Formatting"
                                    >
                                        <X size={18} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* Text Colors */}
                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm gap-0.5 relative">
                                    {/* Text Color */}
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setShowTextColorPicker(!showTextColorPicker)
                                                setShowHighlightColorPicker(false)
                                                setShowFontMenu(false)
                                                setShowSizeMenu(false)
                                                setShowHeadingMenu(false)
                                                setShowLineSpacing(false)
                                            }}
                                            className="w-8 h-8 rounded border-2 border-[var(--accent-espresso)]/30 p-0.5 bg-[var(--bg-surface)] hover:border-[var(--accent-espresso)] transition-colors flex items-center justify-center font-bold text-[var(--accent-espresso)]"
                                            onMouseDown={(e) => e.preventDefault()}
                                            title="Text Color"
                                        >
                                            <span style={{ color: 'var(--accent-espresso)', borderBottom: '3px solid var(--accent-espresso)', paddingBottom: '0px', lineHeight: '1' }}>A</span>
                                        </button>
                                        {showTextColorPicker && (
                                            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-lg shadow-xl p-2 w-32 z-50 flex flex-col gap-1">
                                                <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); execCommand('foreColor', 'black'); setShowTextColorPicker(false); }} className="w-full text-xs font-bold text-[var(--accent-espresso)] hover:bg-[var(--accent-espresso)]/5 py-1 rounded">Auto (Black)</button>
                                                <div className="grid grid-cols-4 gap-1">
                                                    {['#fee2e2', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#f3f4f6', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#1f2937'].map(c => (
                                                        <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); execCommand('foreColor', c); setShowTextColorPicker(false); }} className="w-6 h-6 rounded border border-gray-100 hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: c }} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Highlight Color */}
                                    <div className="relative">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setShowHighlightColorPicker(!showHighlightColorPicker)
                                                setShowTextColorPicker(false)
                                                setShowFontMenu(false)
                                                setShowSizeMenu(false)
                                                setShowHeadingMenu(false)
                                                setShowLineSpacing(false)
                                            }}
                                            className="w-8 h-8 rounded border-2 border-[var(--accent-espresso)]/30 p-0.5 bg-[var(--bg-surface)] hover:border-[var(--accent-espresso)] transition-colors flex items-center justify-center font-bold text-[var(--accent-espresso)]"
                                            onMouseDown={(e) => e.preventDefault()}
                                            title="Highlight Color"
                                        >
                                            <PaintBucket size={16} />
                                        </button>
                                        {showHighlightColorPicker && (
                                            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-lg shadow-xl p-2 w-32 z-50 flex flex-col gap-1">
                                                <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); execCommand('hiliteColor', 'transparent'); setShowHighlightColorPicker(false); }} className="w-full text-xs font-bold text-[var(--accent-espresso)] hover:bg-[var(--accent-espresso)]/5 py-1.5 rounded flex items-center justify-center gap-2 border border-transparent hover:border-[var(--accent-espresso)]/20 transition-colors">
                                                    <span className="relative w-3 h-3 rounded-full border border-gray-400 overflow-hidden">
                                                        <span className="absolute top-1/2 left-[-2px] w-[16px] h-[1px] bg-red-500 rotate-45 transform origin-center"></span>
                                                    </span>
                                                    None
                                                </button>
                                                <div className="grid grid-cols-4 gap-1">
                                                    {['#fee2e2', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#f3f4f6', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#1f2937'].map(c => (
                                                        <button key={c} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); execCommand('hiliteColor', c); setShowHighlightColorPicker(false); }} className="w-6 h-6 rounded border border-gray-100 hover:scale-110 transition-transform shadow-sm" style={{ backgroundColor: c }} />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Alignment */}
                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm gap-0.5">
                                    <button
                                        onClick={() => execCommand('justifyLeft')}
                                        className={`p-2 px-3 rounded-md transition-all border-2 ${activeFormats.alignLeft ? 'bg-[var(--accent-espresso)] text-[var(--bg-cream)] border-[var(--accent-espresso)] shadow-md' : 'hover:bg-[var(--bg-surface)] text-[var(--accent-espresso)] border-transparent'}`}
                                        title="Align Left"
                                    >
                                        <AlignLeft size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => execCommand('justifyCenter')}
                                        className={`p-2 px-3 rounded-md transition-all border-2 ${activeFormats.alignCenter ? 'bg-[var(--accent-espresso)] text-[var(--bg-cream)] border-[var(--accent-espresso)] shadow-md' : 'hover:bg-[var(--bg-surface)] text-[var(--accent-espresso)] border-transparent'}`}
                                        title="Align Center"
                                    >
                                        <AlignCenter size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => execCommand('justifyRight')}
                                        className={`p-2 px-3 rounded-md transition-all border-2 ${activeFormats.alignRight ? 'bg-[var(--accent-espresso)] text-[var(--bg-cream)] border-[var(--accent-espresso)] shadow-md' : 'hover:bg-[var(--bg-surface)] text-[var(--accent-espresso)] border-transparent'}`}
                                        title="Align Right"
                                    >
                                        <AlignRight size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => execCommand('justifyFull')}
                                        className={`p-2 px-3 rounded-md transition-all border-2 ${activeFormats.alignJustify ? 'bg-[var(--accent-espresso)] text-[var(--bg-cream)] border-[var(--accent-espresso)] shadow-md' : 'hover:bg-[var(--bg-surface)] text-[var(--accent-espresso)] border-transparent'}`}
                                        title="Justify"
                                    >
                                        <AlignJustify size={18} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* Line Spacing */}
                                <div className="relative">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            setShowLineSpacing(!showLineSpacing)
                                            setShowFontMenu(false)
                                            setShowSizeMenu(false)
                                            setShowHeadingMenu(false)
                                        }}
                                        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--accent-espresso)]/5 rounded-lg border-2 border-[var(--accent-espresso)]/20 text-sm font-semibold shadow-sm min-w-[110px]"
                                        title="Line Spacing"
                                    >
                                        <span className="text-base font-bold">↕</span>
                                        <span className="flex-1 font-mono">{lineHeight}</span>
                                        <ChevronDown size={16} />
                                    </button>
                                    {showLineSpacing && (
                                        <div className="absolute top-full mt-2 bg-white shadow-2xl rounded-lg border-2 border-gray-300 z-[60] w-36">
                                            {lineSpacings.map(spacing => (
                                                <button
                                                    key={spacing}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        applyLineHeight(spacing)
                                                        setShowLineSpacing(false)
                                                    }}
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    className="w-full text-left px-4 py-3 hover:bg-blue-50 text-sm font-semibold border-b border-gray-100 last:border-0 transition-colors"
                                                >
                                                    {spacing}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Lists */}
                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm gap-0.5">
                                    <button
                                        onClick={() => execCommand('insertUnorderedList')}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30"
                                        title="Bullet List"
                                    >
                                        <List size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => execCommand('insertOrderedList')}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30"
                                        title="Numbered List"
                                    >
                                        <ListOrdered size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => execCommand('insertHTML', '<label style="display: flex; align-items: center; gap: 8px; margin: 8px 0;"><input type="checkbox" style="width: 18px; height: 18px;"> <span contenteditable="true">Checklist item</span></label>')}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30"
                                        title="Checklist"
                                    >
                                        <CheckSquare size={18} strokeWidth={2.5} />
                                    </button>
                                </div>

                                {/* Indent */}
                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm gap-0.5">
                                    <button
                                        onClick={() => execCommand('outdent')}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30"
                                        title="Decrease Indent"
                                    >
                                        <IndentDecrease size={18} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => execCommand('indent')}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30"
                                        title="Increase Indent"
                                    >
                                        <IndentIncrease size={18} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </>
                        )}

                        {/* INSERT TAB */}
                        {activeTab === 'insert' && (
                            <>
                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm gap-0.5">
                                    <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={insertImage}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30 flex items-center gap-2"
                                        title="Insert Image"
                                    >
                                        <ImageIcon size={18} strokeWidth={2.5} />
                                        <span className="text-sm font-semibold">Image</span>
                                    </button>
                                    <button
                                        onClick={insertLink}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30 flex items-center gap-2"
                                        title="Insert Link"
                                    >
                                        <LinkIcon size={18} strokeWidth={2.5} />
                                        <span className="text-sm font-semibold">Link</span>
                                    </button>
                                    <button
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={insertTable}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30 flex items-center gap-2"
                                        title="Insert Table"
                                    >
                                        <TableIcon size={18} strokeWidth={2.5} />
                                        <span className="text-sm font-semibold">Table</span>
                                    </button>
                                    <button
                                        onClick={insertPageBreak}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30 flex items-center gap-2"
                                        title="Page Break"
                                    >
                                        <SplitSquareHorizontal size={18} strokeWidth={2.5} />
                                        <span className="text-sm font-semibold">Page Break</span>
                                    </button>
                                </div>
                            </>
                        )}

                        {/* LAYOUT TAB */}
                        {activeTab === 'layout' && (
                            <>
                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm gap-0.5">
                                    <button
                                        onClick={() => setShowPageSettings(true)}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30 flex items-center gap-2"
                                        title="Page Setup"
                                    >
                                        <Layout size={18} strokeWidth={2.5} />
                                        <span className="text-sm font-semibold">Page Setup</span>
                                    </button>
                                    <button
                                        onClick={() => setShowFindReplace(true)}
                                        className="p-2 px-3 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors border-2 border-transparent hover:border-[var(--accent-espresso)]/30 flex items-center gap-2"
                                        title="Find & Replace"
                                    >
                                        <Search size={18} strokeWidth={2.5} />
                                        <span className="text-sm font-semibold">Find & Replace</span>
                                    </button>
                                </div>

                                {/* Zoom */}
                                <div className="flex items-center gap-2 bg-[var(--bg-cream)]/50 p-1 px-3 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm">
                                    <button
                                        onClick={() => setZoom(Math.max(50, zoom - 10))}
                                        className="p-1.5 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors"
                                        title="Zoom Out"
                                    >
                                        <ZoomOut size={16} strokeWidth={2.5} />
                                    </button>
                                    <span className="text-sm font-mono font-bold text-[var(--accent-espresso)] w-12 text-center">{zoom}%</span>
                                    <button
                                        onClick={() => setZoom(Math.min(200, zoom + 10))}
                                        className="p-1.5 hover:bg-[var(--bg-surface)] rounded-md text-[var(--accent-espresso)] transition-colors"
                                        title="Zoom In"
                                    >
                                        <ZoomIn size={16} strokeWidth={2.5} />
                                    </button>
                                </div>
                            </>
                        )}

                        {/* TABLE TAB */}
                        {activeTab === 'table' && selectedTable && selectedCell && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm gap-0.5">
                                    <button
                                        onClick={() => {
                                            const row = selectedCell.parentElement as HTMLTableRowElement
                                            if (row) {
                                                const newRow = selectedTable.insertRow(row.rowIndex + 1)
                                                for (let i = 0; i < row.cells.length; i++) {
                                                    const cell = newRow.insertCell()
                                                    cell.innerHTML = '&nbsp;'
                                                    cell.style.cssText = 'border: 1px solid #666; padding: 12px; min-width: 40px; min-height: 30px; word-break: break-word;'
                                                }
                                                selectedTable.closest('.document-page')?.dispatchEvent(new Event('input', { bubbles: true }))
                                            }
                                        }}
                                        className="flex flex-col items-center justify-center px-3 py-1 hover:bg-[var(--bg-surface)] rounded text-[var(--accent-espresso)] min-w-[50px] transition-colors"
                                        title="Add Row Below"
                                    >
                                        <Plus size={16} />
                                        <span className="text-[9px] font-bold mt-0.5">ROW</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const index = selectedCell.cellIndex
                                            Array.from(selectedTable.rows).forEach(row => {
                                                const cell = row.insertCell(index + 1)
                                                cell.innerHTML = '&nbsp;'
                                                cell.style.cssText = 'border: 1px solid #666; padding: 12px; min-width: 40px; min-height: 30px; word-break: break-word;'
                                            })
                                            selectedTable.closest('.document-page')?.dispatchEvent(new Event('input', { bubbles: true }))
                                        }}
                                        className="flex flex-col items-center justify-center px-3 py-1 hover:bg-[var(--bg-surface)] rounded text-[var(--accent-espresso)] min-w-[50px] transition-colors"
                                        title="Add Column Right"
                                    >
                                        <Plus size={16} />
                                        <span className="text-[9px] font-bold mt-0.5">COL</span>
                                    </button>
                                </div>

                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm gap-0.5">
                                    <div className="relative">
                                        <button
                                            className="flex flex-col items-center justify-center px-3 py-1 hover:bg-[var(--bg-surface)] rounded text-[var(--accent-espresso)] min-w-[50px] transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setShowColorPicker(!showColorPicker)
                                                setShowTextColorPicker(false)
                                                setShowHighlightColorPicker(false)
                                                setShowFontMenu(false)
                                                setShowSizeMenu(false)
                                                setShowHeadingMenu(false)
                                                setShowLineSpacing(false)
                                            }}
                                            onMouseDown={(e) => e.preventDefault()}
                                            title="Cell Background"
                                        >
                                            <PaintBucket size={16} />
                                            <span className="text-[9px] font-bold mt-0.5">COLOR</span>
                                        </button>
                                        {showColorPicker && (
                                            <div className="absolute top-full left-0 mt-1 bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-lg shadow-xl p-2 w-32 z-50 flex flex-col gap-1">
                                                <button
                                                    className="w-full text-xs font-bold text-[var(--accent-espresso)] hover:bg-[var(--accent-espresso)]/5 py-1.5 rounded flex items-center justify-center gap-2 border border-transparent hover:border-[var(--accent-espresso)]/20 transition-colors"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault()
                                                        const c = 'transparent'
                                                        // Apply to all selected cells if range exists
                                                        const selection = window.getSelection()
                                                        let cellsApplied = false
                                                        if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                                                            const cells = selectedTable.querySelectorAll('td, th')
                                                            cells.forEach(cell => {
                                                                if (selection.containsNode(cell, true)) {
                                                                    (cell as HTMLElement).style.backgroundColor = c
                                                                    cellsApplied = true
                                                                }
                                                            })
                                                        }

                                                        // Fallback to active cell logic
                                                        if (!cellsApplied && selectedCell) {
                                                            selectedCell.style.backgroundColor = c
                                                        }

                                                        selectedTable.closest('.document-page')?.dispatchEvent(new Event('input', { bubbles: true }))
                                                        setShowColorPicker(false)
                                                    }}
                                                >
                                                    <span className="relative w-3 h-3 rounded-full border border-gray-400 overflow-hidden">
                                                        <span className="absolute top-1/2 left-[-2px] w-[16px] h-[1px] bg-red-500 rotate-45 transform origin-center"></span>
                                                    </span>
                                                    None
                                                </button>
                                                <div className="grid grid-cols-4 gap-1">
                                                    {['#fee2e2', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#f3f4f6', '#1f2937'].map(c => (
                                                        <button
                                                            key={c}
                                                            className="w-6 h-6 rounded border border-gray-100 hover:scale-110 transition-transform shadow-sm"
                                                            style={{ backgroundColor: c }}
                                                            onMouseDown={(e) => {
                                                                e.preventDefault()
                                                                // Apply to all selected cells if range exists
                                                                const selection = window.getSelection()
                                                                let cellsApplied = false
                                                                if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
                                                                    const cells = selectedTable.querySelectorAll('td, th')
                                                                    cells.forEach(cell => {
                                                                        if (selection.containsNode(cell, true)) {
                                                                            (cell as HTMLElement).style.backgroundColor = c
                                                                            cellsApplied = true
                                                                        }
                                                                    })
                                                                }

                                                                // Fallback to active cell logic
                                                                if (!cellsApplied && selectedCell) {
                                                                    selectedCell.style.backgroundColor = c
                                                                }

                                                                selectedTable.closest('.document-page')?.dispatchEvent(new Event('input', { bubbles: true }))
                                                                setShowColorPicker(false)
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-peach)]/20 shadow-sm gap-0.5">
                                    <button
                                        onClick={() => {
                                            const row = selectedCell.parentElement as HTMLTableRowElement
                                            if (row && row.rowIndex !== -1) {
                                                selectedTable.deleteRow(row.rowIndex)
                                                selectedTable.closest('.document-page')?.dispatchEvent(new Event('input', { bubbles: true }))
                                                setSelectedCell(null) // Hide toolbar to prevent errors
                                            }
                                        }}
                                        className="flex flex-col items-center justify-center px-3 py-1 hover:bg-[var(--bg-surface)] rounded text-[var(--accent-peach)] min-w-[50px] transition-colors"
                                        title="Delete Row"
                                    >
                                        <Trash2 size={16} />
                                        <span className="text-[9px] font-bold mt-0.5">ROW</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            const index = selectedCell.cellIndex
                                            if (index !== -1) {
                                                Array.from(selectedTable.rows).forEach(row => row.deleteCell(index))
                                                selectedTable.closest('.document-page')?.dispatchEvent(new Event('input', { bubbles: true }))
                                                setSelectedCell(null) // Hide toolbar
                                            }
                                        }}
                                        className="flex flex-col items-center justify-center px-3 py-1 hover:bg-[var(--bg-surface)] rounded text-[var(--accent-peach)] min-w-[50px] transition-colors"
                                        title="Delete Column"
                                    >
                                        <Trash2 size={16} />
                                        <span className="text-[9px] font-bold mt-0.5">COL</span>
                                    </button>
                                    <div className="w-[1px] h-8 bg-[var(--accent-espresso)]/10 mx-1" />
                                    <button
                                        onClick={() => {
                                            const page = selectedTable.closest('.document-page')
                                            selectedTable.remove()
                                            setSelectedTable(null)
                                            setSelectedCell(null)
                                            setActiveTab('format') // Switch tab back
                                            page?.dispatchEvent(new Event('input', { bubbles: true }))
                                        }}
                                        className="flex flex-col items-center justify-center px-3 py-1 hover:bg-[var(--bg-surface)] text-[var(--accent-peach)] rounded min-w-[60px] font-bold transition-colors"
                                        title="Delete Entire Table"
                                    >
                                        <Trash2 size={16} />
                                        <span className="text-[9px] font-bold mt-0.5">TABLE</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* IMAGE TAB */}
                        {activeTab === 'image' && selectedImageWrapper && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center bg-[var(--bg-cream)]/50 p-1 rounded-lg border-2 border-[var(--accent-espresso)]/20 shadow-sm gap-4 px-4 py-2">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-bold text-[var(--accent-espresso)] uppercase tracking-wider">Width</label>
                                        <div className="flex items-center gap-1 bg-[var(--bg-surface)] rounded border border-[var(--accent-espresso)]/20 px-1 focus-within:border-[var(--accent-espresso)] focus-within:ring-1 focus-within:ring-[var(--accent-espresso)]/20 transition-all">
                                            <input
                                                type="number"
                                                value={parseInt(selectedImageWrapper.style.width) || selectedImageWrapper.offsetWidth}
                                                onChange={(e) => {
                                                    const val = Math.max(50, parseInt(e.target.value) || 50)
                                                    selectedImageWrapper.style.width = `${val}px`
                                                    const rect = selectedImageWrapper.getBoundingClientRect()
                                                    setResizeOverlay({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
                                                    selectedImageWrapper.closest('.document-page')?.dispatchEvent(new Event('input', { bubbles: true }))
                                                }}
                                                className="w-16 p-1 text-sm outline-none font-mono text-right text-[var(--accent-espresso)] bg-transparent"
                                            />
                                            <span className="text-[10px] text-[var(--accent-espresso)]/50 font-bold select-none pr-1">px</span>
                                        </div>
                                    </div>
                                    <div className="w-[1px] h-8 bg-[var(--accent-espresso)]/10" />
                                    <div className="flex flex-col gap-1">
                                        <label className="text-[9px] font-bold text-[var(--accent-espresso)] uppercase tracking-wider">Height</label>
                                        <div className="flex items-center gap-1 bg-[var(--bg-surface)] rounded border border-[var(--accent-espresso)]/20 px-1 focus-within:border-[var(--accent-espresso)] focus-within:ring-1 focus-within:ring-[var(--accent-espresso)]/20 transition-all">
                                            <input
                                                type="number"
                                                value={parseInt(selectedImageWrapper.style.height) || selectedImageWrapper.offsetHeight}
                                                onChange={(e) => {
                                                    const val = Math.max(50, parseInt(e.target.value) || 50)
                                                    selectedImageWrapper.style.height = `${val}px`
                                                    const rect = selectedImageWrapper.getBoundingClientRect()
                                                    setResizeOverlay({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
                                                    selectedImageWrapper.closest('.document-page')?.dispatchEvent(new Event('input', { bubbles: true }))
                                                }}
                                                className="w-16 p-1 text-sm outline-none font-mono text-right text-[var(--accent-espresso)] bg-transparent"
                                            />
                                            <span className="text-[10px] text-[var(--accent-espresso)]/50 font-bold select-none pr-1">px</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="ml-auto mr-4 flex items-center gap-2 bg-[var(--bg-cream)]/50 px-3 py-1.5 rounded-lg border-2 border-[var(--accent-espresso)]/20">
                            <span className="text-[10px] font-bold text-[var(--accent-espresso)]/50 uppercase tracking-widest">Pages</span>
                            <span className="text-sm font-bold text-[var(--accent-espresso)]">{currentPage} / {pages.length}</span>
                        </div>
                    </div>
                </div>

                {/* Editor Surface with Page Layout */}
                <div
                    className="flex-1 overflow-y-auto overflow-x-hidden p-8 flex justify-center bg-[var(--bg-cream)]"
                    style={{ scrollbarWidth: 'thin' }}
                >
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        .document-page ul { list-style-type: disc; padding-left: 24px; margin: 8px 0; }
                        .document-page ol { list-style-type: decimal; padding-left: 24px; margin: 8px 0; }
                        .document-page li { margin-bottom: 4px; }
                        .document-page li > p { margin: 0; display: inline; }
                    `}} />
                    <div className="w-full max-w-5xl flex flex-col items-center gap-6">
                        {pages.map((pageContent, index) => (
                            <Page
                                key={index}
                                index={index}
                                content={pageContent}
                                pageSettings={pageSettings}
                                zoom={zoom}
                                fontFamily={'Times New Roman'} // Fixed default base font
                                fontSize={'11'} // Fixed default base size
                                lineHeight={'1.6'} // Fixed default base line-height
                                onInput={(e: any) => handlePageInput(index, e)}
                                onKeyDown={(e: any) => handleKeyDown(e, index)}
                                onPaste={(e: any) => handlePaste(e, index)}
                                setRef={(el: HTMLDivElement) => { pageRefs.current[index] = el }}
                            />
                        ))}

                        {/* Add Page Button */}
                        <div className="w-full max-w-[816px] flex justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => setPages([...pages, ''])}
                                className="bg-[var(--bg-cream)] hover:bg-[var(--bg-cream)]/80 text-[var(--accent-espresso)] px-4 py-2 rounded-full text-sm font-semibold shadow-sm pt-2 border border-[var(--accent-espresso)]/20"
                            >
                                + Add Page
                            </button>
                        </div>
                    </div>
                </div>



                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageUpload}
                />
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-cream)]">
            <div className="p-6 border-b-2 border-[var(--accent-espresso)] bg-[var(--bg-surface)] shadow-sm flex flex-wrap gap-4 justify-between items-center sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[var(--accent-peach)] rounded-lg flex items-center justify-center shadow-lg shadow-[var(--accent-peach)]/30">
                        <FileText className="text-[var(--accent-espresso)]" size={24} />
                    </div>
                    <div>
                        <h2 className="font-bold text-xl sm:text-2xl text-[var(--accent-espresso)] leading-tight">My Documents</h2>
                        <p className="text-xs text-[var(--accent-espresso)]/70 font-medium">Create and Manage your professional drafts</p>
                    </div>
                </div>
                <button
                    onClick={() => docInputRef.current?.click()}
                    className="bg-[var(--bg-cream)] text-[var(--accent-espresso)] border-2 border-[var(--accent-espresso)] px-5 py-2.5 rounded-xl font-bold hover:bg-[var(--accent-espresso)]/10 transition-all flex items-center gap-2 shadow-sm active:scale-95 duration-75 text-sm sm:text-base mr-2"
                >
                    <Upload size={20} strokeWidth={2.5} /> Upload
                </button>
                <button
                    onClick={createDoc}
                    className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl shadow-blue-600/30 active:scale-95 duration-75 text-sm sm:text-base"
                >
                    <Plus size={20} strokeWidth={3} /> New Document
                </button>
                <input
                    type="file"
                    ref={docInputRef}
                    className="hidden"
                    accept=".docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileUpload}
                />
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 content-start custom-scrollbar">
                {loading ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-20 gap-4">
                        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                        <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Syncing with Cloud...</p>
                    </div>
                ) : docs.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-32 text-[var(--accent-espresso)]/40 bg-[var(--bg-surface)]/50 rounded-3xl border-2 border-dashed border-[var(--accent-espresso)]/20">
                        <div className="w-20 h-20 bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)]/20 rounded-full flex items-center justify-center mb-6">
                            <FileText size={40} className="text-[var(--accent-espresso)]/30" />
                        </div>
                        <h3 className="text-lg font-bold text-[var(--accent-espresso)]/60 mb-1">Your library is empty</h3>
                        <p className="text-sm text-[var(--accent-espresso)]/40 mb-8 max-w-xs text-center">Click the "New Document" button to start your first professional project.</p>
                    </div>
                ) : (
                    docs.map(doc => (
                        <div
                            key={doc.id}
                            onClick={() => setActiveDoc(doc)}
                            className="bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-xl p-5 cursor-pointer hover:shadow-[8px_8px_0px_var(--accent-espresso)] transition-all duration-300 group flex flex-col h-[260px] relative overflow-hidden active:scale-[0.98]"
                        >
                            <div className="flex-1 overflow-hidden relative mb-4 rounded-lg bg-white p-4 border border-[var(--accent-espresso)]/20 shadow-inner">
                                <div className="text-[7px] text-black select-none overflow-hidden leading-relaxed font-serif pointer-events-none text-justify opacity-80">
                                    {(doc.content || '').replace(/<[^>]*>?/gm, ' ')}
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-white via-white/40 to-transparent" />
                            </div>

                            <div className="flex flex-col gap-1 relative z-10">
                                <h4 className="font-bold text-[var(--accent-espresso)] truncate text-sm tracking-tight">{doc.title}</h4>
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-bold text-[var(--accent-peach)] uppercase tracking-tighter">
                                        {new Date(doc.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); deleteDoc(doc.id); }}
                                        className="p-2 text-[var(--accent-espresso)]/60 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 ring-1 ring-transparent hover:ring-red-100 shadow-sm"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}