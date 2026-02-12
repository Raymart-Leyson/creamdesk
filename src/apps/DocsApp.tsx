"use client"
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
    ArrowLeft, Plus, Trash2, Printer, FileText, Download, Layout,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough, Subscript, Superscript,
    AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, CheckSquare,
    IndentDecrease, IndentIncrease, Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
    ZoomIn, ZoomOut, Undo, Redo, Search, ChevronDown, X, PaintBucket, Upload, Share2, Eye
} from 'lucide-react'
import mammoth from 'mammoth'

interface Doc { id: string; title: string; content: string; updated_at: string }
interface PageSettings {
    size: 'a4' | 'letter'; orientation: 'portrait' | 'landscape'
    marginTop: number; marginBottom: number; marginLeft: number; marginRight: number
}

const PAGE_W = { a4: { portrait: 794, landscape: 1123 }, letter: { portrait: 816, landscape: 1056 } }
const PAGE_H = { a4: { portrait: 1123, landscape: 794 }, letter: { portrait: 1056, landscape: 816 } }

function TBtn({ children, active, title, onClick, onMouseDown, small }: {
    children: React.ReactNode; active?: boolean; title?: string; small?: boolean
    onClick?: (e: React.MouseEvent) => void; onMouseDown?: (e: React.MouseEvent) => void
}) {
    return (
        <button title={title} onClick={onClick} onMouseDown={onMouseDown}
            className={`flex items-center justify-center rounded transition-colors select-none flex-shrink-0
            ${small ? 'w-6 h-6 text-xs font-bold' : 'w-7 h-7'}
            ${active ? 'bg-[#c2d7f5] text-[#1a73e8]' : 'text-gray-700 hover:bg-gray-100'}`}>
            {children}
        </button>
    )
}
function Sep() { return <div className="w-px h-5 bg-gray-200 mx-0.5 flex-shrink-0" /> }
function DocIcon({ className }: { className?: string }) {
    return (
        <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M28 0H6C3.8 0 2 1.8 2 4v40c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V20L28 0Z" fill="#4285F4" />
            <path d="M28 0v20h20L28 0Z" fill="#86AEED" />
            <path d="M36 28H12v2h24v-2ZM36 32H12v2h24v-2ZM36 24H12v2h24v-2ZM22 16H12v2h10v-2Z" fill="white" />
        </svg>
    )
}

export default function DocsApp() {
    const [docs, setDocs] = useState<Doc[]>([])
    const [activeDoc, setActiveDoc] = useState<Doc | null>(null)
    const [loading, setLoading] = useState(true)
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')

    const editorRef = useRef<HTMLDivElement>(null)
    const saveTimer = useRef<NodeJS.Timeout | null>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)
    const docInputRef = useRef<HTMLInputElement>(null)
    const selSave = useRef<Range | null>(null)
    const resizeState = useRef<{ img: HTMLElement; startX: number; startY: number; startW: number; startH: number; handle: string } | null>(null)

    const [pageSettings, setPageSettings] = useState<PageSettings>({
        size: 'letter', orientation: 'portrait',
        marginTop: 96, marginBottom: 96, marginLeft: 96, marginRight: 96,
    })
    const [zoom, setZoom] = useState(100)
    const [showPageSettings, setShowPageSettings] = useState(false)

    const [fmt, setFmt] = useState({ bold: false, italic: false, underline: false, strike: false, sup: false, sub: false, alignL: true, alignC: false, alignR: false, alignJ: false })
    const [curFont, setCurFont] = useState('Arial')
    const [curSize, setCurSize] = useState('11')
    const [curBlock, setCurBlock] = useState('Normal text')
    const [curLH, setCurLH] = useState('1.15')

    const [dd, setDd] = useState({ font: false, size: false, heading: false, lh: false, textColor: false, hlColor: false, file: false, edit: false, view: false, insert: false, format: false, tableMenu: false, tableCellColor: false, wordCount: false, findReplace: false, outline: false })
    const toggleDd = (key: keyof typeof dd) => setDd(p => { const n = Object.fromEntries(Object.keys(p).map(k => [k, false])) as typeof p; n[key] = !p[key]; return n })
    const closeAll = useCallback(() => setDd(p => Object.fromEntries(Object.keys(p).map(k => [k, false])) as typeof p), [])

    const [wordCount, setWordCount] = useState(0)
    const [charCount, setCharCount] = useState(0)
    const [outlineItems, setOutlineItems] = useState<{ text: string; level: number; id: string }[]>([])
    const [findText, setFindText] = useState('')
    const [replaceText, setReplaceText] = useState('')
    const [findCount, setFindCount] = useState(0)
    const [tablePick, setTablePick] = useState({ r: 0, c: 0 })

    const [selTable, setSelTable] = useState<HTMLTableElement | null>(null)
    const [selCell, setSelCell] = useState<HTMLTableCellElement | null>(null)
    const [selImg, setSelImg] = useState<HTMLElement | null>(null)
    const [imgOverlay, setImgOverlay] = useState<{ top: number; left: number; w: number; h: number } | null>(null)

    useEffect(() => { fetchDocs() }, [])
    useEffect(() => {
        if (activeDoc && editorRef.current) {
            editorRef.current.innerHTML = activeDoc.content || '<p><br></p>'
            updateCounts(); updateOutline()
        }
    }, [activeDoc?.id])

    const updateImgOverlay = useCallback(() => {
        if (selImg) { const r = selImg.getBoundingClientRect(); setImgOverlay({ top: r.top, left: r.left, w: r.width, h: r.height }) }
    }, [selImg])

    useEffect(() => {
        const onMD = (e: MouseEvent) => {
            const t = e.target as HTMLElement
            if (!t.closest('.gdoc-dd') && !t.closest('.gdoc-toolbar') && !t.closest('.gdoc-menubar')) closeAll()
            if (t.closest('.gdoc-toolbar') || t.closest('.gdoc-menubar')) {
                const s = window.getSelection(); if (s?.rangeCount) selSave.current = s.getRangeAt(0).cloneRange()
            }
        }
        const onMM = (e: MouseEvent) => {
            if (!resizeState.current) return; e.preventDefault()
            const { img, startX, startY, startW, startH, handle } = resizeState.current
            const dx = e.clientX - startX, dy = e.clientY - startY
            let nw = startW, nh = startH
            if (handle.includes('e')) nw = Math.max(40, startW + dx)
            if (handle.includes('w')) nw = Math.max(40, startW - dx)
            if (handle.includes('s')) nh = Math.max(40, startH + dy)
            if (handle.includes('n')) nh = Math.max(40, startH - dy)
            img.style.width = nw + 'px'; img.style.height = nh + 'px'
            const r = img.getBoundingClientRect(); setImgOverlay({ top: r.top, left: r.left, w: r.width, h: r.height })
        }
        const onMU = () => { if (resizeState.current) { resizeState.current = null; triggerSave() } }
        const onSel = () => {
            const sel = window.getSelection(); if (!sel?.anchorNode) return
            const el = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode.parentElement
            if (!el?.closest('#gdoc-editor')) return
            try {
                setFmt({ bold: document.queryCommandState('bold'), italic: document.queryCommandState('italic'), underline: document.queryCommandState('underline'), strike: document.queryCommandState('strikeThrough'), sup: document.queryCommandState('superscript'), sub: document.queryCommandState('subscript'), alignL: document.queryCommandState('justifyLeft'), alignC: document.queryCommandState('justifyCenter'), alignR: document.queryCommandState('justifyRight'), alignJ: document.queryCommandState('justifyFull') })
                const fn = document.queryCommandValue('fontName'); if (fn) setCurFont(fn.replace(/['"]/g, ''))
                const bk = document.queryCommandValue('formatBlock')
                const bmap: Record<string, string> = { p: 'Normal text', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3', h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6', blockquote: 'Quote' }
                setCurBlock(bmap[bk?.toLowerCase()] || 'Normal text')
            } catch (_) { }
        }
        document.addEventListener('mousedown', onMD); document.addEventListener('mousemove', onMM)
        document.addEventListener('mouseup', onMU); document.addEventListener('selectionchange', onSel)
        window.addEventListener('scroll', updateImgOverlay, true); window.addEventListener('resize', updateImgOverlay)
        return () => {
            document.removeEventListener('mousedown', onMD); document.removeEventListener('mousemove', onMM)
            document.removeEventListener('mouseup', onMU); document.removeEventListener('selectionchange', onSel)
            window.removeEventListener('scroll', updateImgOverlay, true); window.removeEventListener('resize', updateImgOverlay)
        }
    }, [closeAll, updateImgOverlay])

    const fetchDocs = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        const { data } = await supabase.from('documents').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
        if (data) setDocs(data); setLoading(false)
    }
    const createDoc = async () => {
        const { data: { user } } = await supabase.auth.getUser(); if (!user) { alert('Please log in.'); return }
        const { data, error } = await supabase.from('documents').insert({ user_id: user.id, title: 'Untitled document', content: '<p><br></p>' }).select().single()
        if (!error && data) { setDocs(p => [data, ...p]); setActiveDoc(data) }
    }
    const saveDoc = useCallback(async (id: string, content: string, title?: string) => {
        setSaveStatus('saving')
        const up: any = { content }; if (title !== undefined) up.title = title
        const { error } = await supabase.from('documents').update(up).eq('id', id)
        if (!error) { setDocs(p => p.map(d => d.id === id ? { ...d, ...up, updated_at: new Date().toISOString() } : d)); setSaveStatus('saved') }
    }, [])
    const triggerSave = useCallback(() => {
        if (!activeDoc || !editorRef.current) return; setSaveStatus('unsaved')
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => saveDoc(activeDoc.id, editorRef.current!.innerHTML), 1500)
    }, [activeDoc, saveDoc])
    const deleteDoc = async (id: string) => {
        if (!confirm('Delete this document?')) return
        await supabase.from('documents').delete().eq('id', id)
        setDocs(p => p.filter(d => d.id !== id)); if (activeDoc?.id === id) setActiveDoc(null)
    }
    const handleTitleChange = (t: string) => {
        if (!activeDoc) return; setActiveDoc(p => p ? { ...p, title: t } : p)
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => saveDoc(activeDoc.id, editorRef.current?.innerHTML || '', t), 1000)
    }

    const exec = useCallback((cmd: string, val?: string) => {
        editorRef.current?.focus()
        if (selSave.current) { const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(selSave.current) }
        document.execCommand(cmd, false, val); triggerSave()
    }, [triggerSave])

    const applyFont = (f: string) => { editorRef.current?.focus(); if (selSave.current) { const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(selSave.current) }; document.execCommand('fontName', false, f); setCurFont(f); closeAll(); triggerSave() }
    const applySize = (s: string) => {
        editorRef.current?.focus(); if (selSave.current) { const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(selSave.current) }
        document.execCommand('fontSize', false, '7')
        editorRef.current?.querySelectorAll('font[size="7"]').forEach(el => { (el as HTMLElement).removeAttribute('size'); (el as HTMLElement).style.fontSize = s + 'pt' })
        setCurSize(s); closeAll(); triggerSave()
    }
    const applyHeading = (tag: string, label: string) => { exec('formatBlock', tag); setCurBlock(label); closeAll() }
    const applyLH = (lh: string) => {
        const sel = window.getSelection(); if (!sel?.rangeCount) { setCurLH(lh); closeAll(); return }
        let node: Node | null = sel.getRangeAt(0).commonAncestorContainer
        if (node.nodeType === 3) node = node.parentNode
        while (node && node !== editorRef.current) {
            if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'BLOCKQUOTE'].includes((node as HTMLElement).nodeName)) { (node as HTMLElement).style.lineHeight = lh; break }
            node = node.parentNode
        }
        setCurLH(lh); closeAll(); triggerSave()
    }

    // ── Helper Functions ─────────────────────────────────────────────────────
    const updateCounts = () => { const t = editorRef.current?.innerText || ''; setWordCount(t.trim() ? t.trim().split(/\s+/).length : 0); setCharCount(t.length) }
    const updateOutline = () => {
        if (!editorRef.current) return
        setOutlineItems(Array.from(editorRef.current.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((h, i) => { const id = `ol-${i}`; h.id = id; return { text: h.textContent || '', level: parseInt(h.tagName[1]), id } }))
    }
    const doFind = () => {
        if (!findText || !editorRef.current) return
        const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        setFindCount((editorRef.current.innerHTML.match(re) || []).length); (window as any).find?.(findText)
    }
    const doReplaceAll = () => {
        if (!findText || !editorRef.current) return
        editorRef.current.innerHTML = editorRef.current.innerHTML.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replaceText); triggerSave()
    }
    const doPrint = () => {
        if (!activeDoc || !editorRef.current) return
        const { marginTop: mt, marginBottom: mb, marginLeft: ml, marginRight: mr } = pageSettings
        const pw = window.open('', '_blank', 'width=900,height=700')!
        pw.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${activeDoc.title}</title><style>@page{size:${pageSettings.size === 'a4' ? 'A4' : 'letter'} ${pageSettings.orientation};margin:${mt * .2646}mm ${mr * .2646}mm ${mb * .2646}mm ${ml * .2646}mm}body{font-family:Arial,sans-serif;font-size:11pt;line-height:1.15;color:#000;margin:0;padding:0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #c7c7c7;padding:6px 8px}img{max-width:100%;height:auto}h1{font-size:20pt;font-weight:bold}h2{font-size:16pt;font-weight:bold}h3{font-size:14pt;font-weight:bold}p{margin:0 0 6pt}.gdoc-img-wrapper{display:inline-block}.pdf-page-img{display:block;width:100%;}</style></head><body>${editorRef.current.innerHTML}</body></html>`)
        pw.document.close(); pw.focus(); setTimeout(() => pw.print(), 500)
    }
    const doDownload = () => {
        if (!activeDoc || !editorRef.current) return
        const h = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${activeDoc.title}</title><style>body{font-family:Arial;font-size:11pt}table{border-collapse:collapse}td{border:1px solid #ccc;padding:6px}</style></head><body>${editorRef.current.innerHTML}</body></html>`
        const blob = new Blob(['\ufeff', h], { type: 'application/msword' }); const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = `${activeDoc.title}.doc`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    }

    // ── Pagination Logic ─────────────────────────────────────────────────────
    const paginate = useCallback(() => {
        if (!editorRef.current) return

        // Save selection/cursor
        const sel = window.getSelection()
        let savedSel: { node: Node, offset: number } | null = null
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0)
            savedSel = { node: range.startContainer, offset: range.startOffset }
        }

        const editor = editorRef.current
        // 1. Remove existing auto-breaks to remeasure
        editor.querySelectorAll('.auto-break').forEach(el => el.remove())

        // 2. Constants
        const zoomScale = zoom / 100
        const pageH_px = PAGE_H[pageSettings.size][pageSettings.orientation] // logical pixels (unzoomed)
        // Calculating the content height usually available on a page.
        // But since we are accumulating height of children, we compare against the FULL page height
        // minus the gaps we *will* insert? No.
        // We just need to know: When does the content *exceed* the current page's capacity?
        // Capacity = Page Height - Margins?
        // Actually, the editor has padding (margins). The content flows inside that padding.
        // So the "Page Content Area" height is approx (Page Height - Top Margin - Bottom Margin).
        // Let's use that as the threshold.
        const contentH = pageH_px - (pageSettings.marginTop + pageSettings.marginBottom)

        let currentH = 0
        const children = Array.from(editor.children)

        children.forEach((child) => {
            const el = child as HTMLElement
            // If it's a Manual Break, reset counter
            if (el.classList.contains('gdoc-page-break') && el.dataset.type === 'manual') {
                currentH = 0
                return
            }

            const h = el.offsetHeight

            // If this element makes us exceed the page content height
            // And it's not the *first* element on the page (currentH > 0)
            // Then insert a break before it
            if (currentH + h > contentH && currentH > 0) {
                const br = document.createElement('div')
                br.className = 'gdoc-page-break auto-break'
                br.contentEditable = 'false'
                // The visual height/margins are handled by CSS
                editor.insertBefore(br, el)

                // Reset for next page (start with this element's height)
                currentH = h
            } else {
                currentH += h
            }
        })

        // Restore selection
        if (savedSel && editor.contains(savedSel.node)) {
            try {
                const range = document.createRange()
                range.setStart(savedSel.node, savedSel.offset)
                range.collapse(true)
                sel?.removeAllRanges()
                sel?.addRange(range)
            } catch (e) { /* Optimization: cursor might have been in a removed text node (rare) */ }
        }
    }, [zoom, pageSettings])

    // Debounced pagination trigger
    const paginationTimer = useRef<NodeJS.Timeout | null>(null)
    const triggerPagination = useCallback(() => {
        if (paginationTimer.current) clearTimeout(paginationTimer.current)
        paginationTimer.current = setTimeout(paginate, 1000) // 1s debounce to avoid thrashing
    }, [paginate])

    // ── Editor Actions ───────────────────────────────────────────────────────
    const insertPageBreak = () => {
        exec('insertHTML', '<div class="gdoc-page-break" data-type="manual" contenteditable="false"></div><p><br></p>')
        triggerPagination()
    }
    const insertImg = (src: string) => {
        editorRef.current?.focus()
        if (selSave.current) { const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(selSave.current) }
        document.execCommand('insertHTML', false, `<span class="gdoc-img-wrapper" contenteditable="false" style="display:inline-block;position:relative;width:320px;height:240px;vertical-align:bottom;"><img src="${src}" style="width:100%;height:100%;display:block;object-fit:contain;" /></span>&#8203;`)
        triggerSave()
    }
    const insertTable = (rows: number, cols: number) => {
        let h = '<table style="border-collapse:collapse;width:100%;margin:8px 0;"><tbody>'
        for (let r = 0; r < rows; r++) { h += '<tr>'; for (let c = 0; c < cols; c++) h += '<td style="border:1px solid #c7c7c7;padding:6px 8px;min-width:40px;vertical-align:top;"><p style="margin:0;"><br></p></td>'; h += '</tr>' }
        h += '</tbody></table><p><br></p>'; exec('insertHTML', h)
    }
    const insertLink = () => { const u = prompt('URL:', 'https://'); if (u) exec('createLink', u) }
    const insertHR = () => exec('insertHTML', '<hr style="border:none;border-top:2px solid #e0e0e0;margin:16px 0;" /><p><br></p>')

    const startResize = (e: React.MouseEvent, handle: string) => {
        e.preventDefault(); e.stopPropagation(); if (!selImg) return
        resizeState.current = { img: selImg, startX: e.clientX, startY: e.clientY, startW: selImg.offsetWidth, startH: selImg.offsetHeight, handle }
    }
    const onImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return
        const fr = new FileReader(); fr.onload = ev => insertImg(ev.target!.result as string); fr.readAsDataURL(f); e.target.value = ''
    }

    // ── Event Handlers ───────────────────────────────────────────────────────
    const onInput = useCallback(() => {
        updateCounts(); updateOutline(); triggerSave(); triggerPagination()
    }, [triggerSave, triggerPagination])

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') { e.preventDefault(); exec('bold') }
        if ((e.ctrlKey || e.metaKey) && e.key === 'i') { e.preventDefault(); exec('italic') }
        if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); exec('underline') }
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') { e.preventDefault(); setDd(p => ({ ...p, findReplace: true })) }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); insertPageBreak() }
    }, [exec, insertPageBreak])

    const onPaste = useCallback((e: React.ClipboardEvent) => {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                e.preventDefault(); const blob = items[i].getAsFile()!
                const fr = new FileReader(); fr.onload = ev => insertImg(ev.target!.result as string); fr.readAsDataURL(blob); return
            }
        }
        triggerPagination()
    }, [triggerPagination])

    const onClick = useCallback((e: React.MouseEvent) => {
        const t = e.target as HTMLElement
        setSelCell(t.closest('td,th') as HTMLTableCellElement | null)
        setSelTable(t.closest('table') as HTMLTableElement | null)
        const wrapper = t.classList.contains('gdoc-img-wrapper') ? t : t.closest('.gdoc-img-wrapper') as HTMLElement | null
        if (wrapper) { setSelImg(wrapper); const r = wrapper.getBoundingClientRect(); setImgOverlay({ top: r.top, left: r.left, w: r.width, h: r.height }); return }
        if (!t.closest('.gdoc-resize-handle')) { setSelImg(null); setImgOverlay(null) }
        const sel = window.getSelection(); if (sel?.rangeCount) selSave.current = sel.getRangeAt(0).cloneRange()
    }, [])

    useEffect(() => { if (!loading) triggerPagination() }, [loading, docs, pageSettings, triggerPagination])

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return
        e.target.value = ''
        setLoading(true)
        try {
            let content = ''
            if (file.name.toLowerCase().endsWith('.docx') || file.type.includes('wordprocessingml')) {
                const ab = await file.arrayBuffer()
                const result = await mammoth.convertToHtml({ arrayBuffer: ab }, {
                    styleMap: [
                        "p[style-name='Heading 1'] => h1:fresh", "p[style-name='Heading 2'] => h2:fresh",
                        "p[style-name='Heading 3'] => h3:fresh", "p[style-name='Heading 4'] => h4:fresh",
                        "p[style-name='Heading 5'] => h5:fresh", "p[style-name='Title'] => h1.doc-title:fresh",
                        "p[style-name='Subtitle'] => p.doc-subtitle:fresh", "p[style-name='Quote'] => blockquote:fresh",
                        "b => strong", "i => em", "u => u", "strike => s",
                        "table => table", "tr => tr", "td => td",
                    ],
                    convertImage: mammoth.images.dataUri,
                } as any)
                content = result.value
                    .replace(/<p>\s*<\/p>/gi, '<p><br></p>')
                    .replace(/class="doc-title"/g, 'style="font-size:24pt;font-weight:bold;margin:0 0 8pt;"')
                    .replace(/class="doc-subtitle"/g, 'style="font-size:13pt;color:#555;margin:0 0 14pt;"')
                    .replace(/<img /gi, '<img style="max-width:100%;height:auto;display:block;margin:8px 0;" ')
            } else if (file.type === 'application/pdf') {
                content = await convertPdfToEditableHtml(file)
            } else { alert('Please upload a .docx or .pdf file'); setLoading(false); return }

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { alert('Please log in.'); setLoading(false); return }
            const title = file.name.replace(/\.[^/.]+$/, '')
            const { data, error } = await supabase.from('documents').insert({ user_id: user.id, title, content }).select().single()
            if (error) throw error
            if (data) { setDocs(p => [data, ...p]); setActiveDoc(data) }
        } catch (err: any) { console.error(err); alert('Upload failed: ' + (err.message || err)) }
        finally { setLoading(false) }
    }

    // PDF → Editable HTML (Approximate text layout)
    async function convertPdfToEditableHtml(file: File): Promise<string> {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
        const ab = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise
        let html = ''

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i)
            const textContent = await page.getTextContent()

            // Simple text extraction strategy: sort items by Y then X
            const items = textContent.items as any[]
            items.sort((a, b) => {
                if (Math.abs(a.transform[5] - b.transform[5]) > 5) return b.transform[5] - a.transform[5] // Sort by line (Y desc)
                return a.transform[4] - b.transform[4] // Then by X asc
            })

            let pageHtml = ''
            let lastY = -1

            for (const item of items) {
                const text = item.str
                if (!text.trim()) continue

                // New paragraph/line detection
                if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 10) {
                    pageHtml += '</p><p>'
                } else if (pageHtml === '') {
                    pageHtml += '<p>'
                } else {
                    pageHtml += ' '
                }

                // Basic font size mapping
                const height = item.height || 11
                if (height > 18) pageHtml += `<strong>${text}</strong>`
                else pageHtml += text

                lastY = item.transform[5]
            }
            if (pageHtml) pageHtml += '</p>'

            html += pageHtml
            // Insert Page Break between pages (except after the last one)
            if (i < pdf.numPages) {
                html += `<div class="gdoc-page-break" data-type="manual" contenteditable="false"></div><p><br></p>`
            }
        }

        return html || '<p>Could not extract text from this PDF.</p>'
    }

    // (Deprecated) PDF → canvas images
    const renderPdfAsImages = async (file: File): Promise<string> => {
        // Kept for reference or fallback if needed, but not used by default now
        return convertPdfToEditableHtml(file)
    }

    const pgW = PAGE_W[pageSettings.size][pageSettings.orientation] * (zoom / 100)
    const pgH = PAGE_H[pageSettings.size][pageSettings.orientation] * (zoom / 100)
    const mt = pageSettings.marginTop * (zoom / 100), mb = pageSettings.marginBottom * (zoom / 100)
    const ml = pageSettings.marginLeft * (zoom / 100), mr = pageSettings.marginRight * (zoom / 100)

    const FONTS = ['Arial', 'Arial Black', 'Comic Sans MS', 'Courier New', 'Georgia', 'Impact', 'Palatino Linotype', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Roboto', 'Lato', 'Montserrat', 'Open Sans', 'Raleway', 'Merriweather', 'Playfair Display', 'Lora', 'Nunito', 'Ubuntu']
    const SIZES = ['8', '9', '10', '11', '12', '14', '16', '18', '20', '22', '24', '26', '28', '36', '48', '72']
    const LHS = ['1', '1.15', '1.5', '2', '2.5', '3']
    const txtColors = ['#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#ffffff', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#9900ff', '#ff00ff', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#cfe2f3', '#d9d2e9', '#ead1dc', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#9fc5e8', '#b4a7d6', '#d5a6bd', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6fa8dc', '#8e7cc3', '#c27ba0', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3d85c8', '#674ea7', '#a64d79']
    const hlColors = ['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#ff0000', '#0000ff', '#ffa500', '#ffffff', '#000000', '#ffe599', '#d9ead3', '#cfe2f3', '#f4cccc', '#d9d2e9']

    // ──────────────────────────────────────────────────────────────────────────
    // DOCUMENT LIST VIEW
    // ──────────────────────────────────────────────────────────────────────────
    if (!activeDoc) return (
        <div className="flex flex-col h-full bg-white">
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
                <div className="flex items-center gap-2 flex-1">
                    <DocIcon className="w-9 h-9 flex-shrink-0" />
                    <span className="text-xl text-gray-700 font-medium" style={{ fontFamily: 'Google Sans,Arial,sans-serif' }}>Docs</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Use label wrapping input — avoids the controlled/uncontrolled React warning entirely */}
                    <label className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1a73e8] hover:bg-blue-50 rounded-full cursor-pointer transition-colors">
                        <Upload size={16} /> Upload
                        <input type="file" className="hidden"
                            accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                            onChange={handleFileUpload} />
                    </label>
                    <button onClick={createDoc} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded-full shadow-sm transition-colors">
                        <Plus size={16} /> New
                    </button>
                </div>
            </div>

            <div className="bg-[#f8f9fa] border-b border-gray-200 py-6 px-6">
                <div className="max-w-5xl mx-auto">
                    <p className="text-sm text-gray-600 mb-4 font-medium">Start a new document</p>
                    <div className="flex gap-4 overflow-x-auto pb-2">
                        {[{ n: 'Blank', c: '', blank: true }, { n: 'Resume', c: '#fbbc04' }, { n: 'Report', c: '#34a853' }, { n: 'Letter', c: '#4285f4' }].map(t => (
                            <button key={t.n} onClick={createDoc} className="flex flex-col items-center gap-2 flex-shrink-0 group">
                                <div className="w-24 h-32 bg-white border-2 border-transparent group-hover:border-[#1a73e8] rounded shadow-md flex items-center justify-center transition-all overflow-hidden">
                                    {t.blank ? <Plus size={28} className="text-gray-300 group-hover:text-[#1a73e8] transition-colors" /> :
                                        <div className="w-full h-full p-2"><div className="h-1.5 rounded mb-1.5" style={{ backgroundColor: t.c, width: '70%' }} />{[80, 60, 90, 70, 85].map((w, i) => <div key={i} className="h-1 bg-gray-200 rounded mb-1" style={{ width: `${w}%` }} />)}</div>}
                                </div>
                                <span className="text-xs text-gray-700">{t.n}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="max-w-5xl mx-auto px-6 py-6">
                    <p className="text-sm font-medium text-gray-700 mb-4">Recent documents</p>
                    {loading ? (
                        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-[#1a73e8]/20 border-t-[#1a73e8] rounded-full animate-spin" /></div>
                    ) : docs.length === 0 ? (
                        <div className="text-center py-16 text-gray-400"><FileText size={48} className="mx-auto mb-3 opacity-30" /><p className="text-sm">No documents yet — create or upload one!</p></div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {docs.map(doc => (
                                <div key={doc.id} onClick={() => setActiveDoc(doc)} className="group cursor-pointer rounded-lg border border-gray-200 hover:border-[#1a73e8] bg-white overflow-hidden shadow-sm hover:shadow-md transition-all">
                                    <div className="h-32 bg-[#f8f9fa] p-3 overflow-hidden relative">
                                        <div className="text-[6px] leading-tight text-gray-700 pointer-events-none select-none">{doc.content.replace(/<[^>]*>/g, ' ').slice(0, 400)}</div>
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#f8f9fa]" />
                                    </div>
                                    <div className="p-2.5 flex items-center gap-2">
                                        <DocIcon className="w-5 h-5 flex-shrink-0" />
                                        <div className="flex-1 min-w-0"><p className="text-xs font-medium text-gray-800 truncate">{doc.title}</p><p className="text-[10px] text-gray-500">{new Date(doc.updated_at).toLocaleDateString()}</p></div>
                                        <button onClick={ev => { ev.stopPropagation(); deleteDoc(doc.id) }} className="p-1 rounded text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )

    // ──────────────────────────────────────────────────────────────────────────
    // EDITOR VIEW
    // ──────────────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-full bg-[#f8f9fa] overflow-hidden" style={{ userSelect: 'none' }}>

            {/* Top bar */}
            <div className="bg-white flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 flex-shrink-0 gdoc-toolbar" style={{ minHeight: 56 }}>
                <button onClick={() => setActiveDoc(null)} className="p-1.5 hover:bg-gray-100 rounded-full flex-shrink-0"><ArrowLeft size={20} className="text-gray-600" /></button>
                <DocIcon className="w-8 h-8 flex-shrink-0" />
                <div className="flex flex-col flex-1 min-w-0">
                    <input value={activeDoc.title} onChange={e => handleTitleChange(e.target.value)}
                        className="text-base font-normal text-gray-800 bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-[#1a73e8] focus:outline-none px-1 py-0.5 max-w-sm transition-colors" />
                    <div className="text-[10px] text-gray-400 px-1">
                        {saveStatus === 'saving' ? '⟳ Saving…' : saveStatus === 'saved' ? '✓ All changes saved' : '● Unsaved changes'}
                    </div>
                </div>
                <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                    <button onClick={() => toggleDd('outline')} title="Document outline" className={`p-2 rounded-full transition-colors ${dd.outline ? 'bg-blue-50 text-[#1a73e8]' : 'hover:bg-gray-100 text-gray-600'}`}><Eye size={18} /></button>
                    <button onClick={doPrint} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-full"><Printer size={15} /><span className="hidden sm:inline">Print</span></button>
                    <button onClick={doDownload} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-full"><Download size={15} /><span className="hidden sm:inline">Download</span></button>
                    <button className="flex items-center gap-1.5 px-4 py-1.5 text-sm text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded-full shadow-sm transition-colors"><Share2 size={13} />Share</button>
                </div>
            </div>

            {/* Menu bar */}
            <div className="bg-white flex items-center px-3 border-b border-gray-100 flex-shrink-0 gdoc-menubar" style={{ minHeight: 28 }}>
                {([
                    {
                        k: 'file', l: 'File', items: [
                            { l: 'New', a: createDoc, icon: <Plus size={13} /> },
                            null,
                            { l: 'Page setup…', a: () => { closeAll(); setShowPageSettings(true) }, icon: <Layout size={13} /> },
                            null,
                            { l: 'Print', a: doPrint, icon: <Printer size={13} />, kbd: 'Ctrl+P' },
                            { l: 'Download as .doc', a: doDownload, icon: <Download size={13} /> },
                        ]
                    },
                    {
                        k: 'edit', l: 'Edit', items: [
                            { l: 'Undo', a: () => exec('undo'), kbd: 'Ctrl+Z' },
                            { l: 'Redo', a: () => exec('redo'), kbd: 'Ctrl+Y' },
                            null,
                            { l: 'Select all', a: () => exec('selectAll'), kbd: 'Ctrl+A' },
                            { l: 'Find & replace…', a: () => setDd(p => ({ ...p, findReplace: true })), kbd: 'Ctrl+F' },
                        ]
                    },
                    {
                        k: 'view', l: 'View', items: [
                            { l: 'Document outline', a: () => toggleDd('outline') },
                            { l: `Word count (${wordCount})`, a: () => setDd(p => ({ ...p, wordCount: true })) },
                            null,
                            { l: 'Zoom in', a: () => setZoom(z => Math.min(200, z + 10)), kbd: 'Ctrl++' },
                            { l: 'Zoom out', a: () => setZoom(z => Math.max(50, z - 10)), kbd: 'Ctrl+-' },
                            { l: 'Reset (100%)', a: () => setZoom(100) },
                        ]
                    },
                    {
                        k: 'insert', l: 'Insert', items: [
                            { l: 'Image…', a: () => { closeAll(); selSave.current = window.getSelection()?.getRangeAt(0)?.cloneRange() || null; imageInputRef.current?.click() }, icon: <ImageIcon size={13} /> },
                            { l: 'Link…', a: () => { closeAll(); insertLink() }, icon: <LinkIcon size={13} />, kbd: 'Ctrl+K' },
                            { l: 'Horizontal rule', a: insertHR },
                            { l: 'Page break', a: insertPageBreak, kbd: 'Ctrl+Enter' },
                        ]
                    },
                    {
                        k: 'format', l: 'Format', items: [
                            { l: 'Bold', a: () => exec('bold'), kbd: 'Ctrl+B' },
                            { l: 'Italic', a: () => exec('italic'), kbd: 'Ctrl+I' },
                            { l: 'Underline', a: () => exec('underline'), kbd: 'Ctrl+U' },
                            { l: 'Strikethrough', a: () => exec('strikeThrough') },
                            null,
                            { l: 'Superscript', a: () => exec('superscript') },
                            { l: 'Subscript', a: () => exec('subscript') },
                            null,
                            { l: 'Clear formatting', a: () => exec('removeFormat'), kbd: 'Ctrl+\\' },
                        ]
                    },
                ] as any[]).map((menu: any) => (
                    <div key={menu.k} className="relative gdoc-dd">
                        <button onClick={() => toggleDd(menu.k as any)} className={`px-2 py-1 text-sm rounded transition-colors ${dd[menu.k as keyof typeof dd] ? 'bg-blue-50 text-[#1a73e8]' : 'text-gray-700 hover:bg-gray-100'}`}>{menu.l}</button>
                        {dd[menu.k as keyof typeof dd] && (
                            <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[200] min-w-[200px] py-1">
                                {menu.items.map((item: any, i: number) => item === null
                                    ? <div key={i} className="h-px bg-gray-100 my-1" />
                                    : <button key={i} onClick={() => { item.a?.(); closeAll() }} className="w-full flex items-center justify-between px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                                        <span className="flex items-center gap-2">{item.icon}{item.l}</span>
                                        {item.kbd && <span className="text-xs text-gray-400">{item.kbd}</span>}
                                    </button>)}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Toolbar ribbon */}
            <div className="bg-white border-b border-gray-200 px-2 py-1 flex items-center gap-0.5 flex-wrap flex-shrink-0 gdoc-toolbar" style={{ minHeight: 40 }}>
                <TBtn title="Undo" onClick={() => exec('undo')}><Undo size={14} /></TBtn>
                <TBtn title="Redo" onClick={() => exec('redo')}><Redo size={14} /></TBtn>
                <TBtn title="Print" onClick={doPrint}><Printer size={14} /></TBtn>
                <Sep />

                {/* Zoom */}
                <TBtn small title="Zoom out" onClick={() => setZoom(z => Math.max(50, z - 10))}><ZoomOut size={13} /></TBtn>
                <button onClick={() => setZoom(100)} className="text-[11px] text-gray-600 w-9 text-center hover:bg-gray-100 rounded py-0.5 font-mono">{zoom}%</button>
                <TBtn small title="Zoom in" onClick={() => setZoom(z => Math.min(200, z + 10))}><ZoomIn size={13} /></TBtn>
                <Sep />

                {/* Block style */}
                <div className="relative gdoc-dd">
                    <button onClick={() => toggleDd('heading')} onMouseDown={e => { const s = window.getSelection(); if (s?.rangeCount) selSave.current = s.getRangeAt(0).cloneRange() }}
                        className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-100 rounded text-xs text-gray-700 border border-gray-300 w-28 justify-between h-7">
                        <span className="truncate">{curBlock}</span><ChevronDown size={11} />
                    </button>
                    {dd.heading && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[200] w-40 py-1">
                            {[['p', 'Normal text'], ['h1', 'Heading 1'], ['h2', 'Heading 2'], ['h3', 'Heading 3'], ['h4', 'Heading 4'], ['h5', 'Heading 5'], ['h6', 'Heading 6'], ['blockquote', 'Quote']].map(([t, l]) => (
                                <button key={t} onMouseDown={e => e.preventDefault()} onClick={() => applyHeading(t, l)}
                                    className={`w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50 ${curBlock === l ? 'bg-blue-50 text-[#1a73e8]' : ''}`}
                                    style={t === 'h1' ? { fontSize: 16, fontWeight: 'bold' } : t === 'h2' ? { fontSize: 14, fontWeight: 'bold' } : t === 'h3' ? { fontSize: 13, fontWeight: 'bold' } : { fontSize: 12 }}>{l}</button>
                            ))}
                        </div>
                    )}
                </div>
                <Sep />

                {/* Font family */}
                <div className="relative gdoc-dd">
                    <button onClick={() => toggleDd('font')} onMouseDown={e => { const s = window.getSelection(); if (s?.rangeCount) selSave.current = s.getRangeAt(0).cloneRange() }}
                        className="flex items-center gap-1 px-2 py-0.5 hover:bg-gray-100 rounded text-xs text-gray-700 border border-gray-300 w-32 justify-between h-7">
                        <span className="truncate" style={{ fontFamily: curFont }}>{curFont}</span><ChevronDown size={11} />
                    </button>
                    {dd.font && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[200] w-44 max-h-56 overflow-y-auto py-1">
                            {FONTS.map(f => <button key={f} onMouseDown={e => e.preventDefault()} onClick={() => applyFont(f)}
                                className={`w-full text-left px-4 py-1.5 text-sm hover:bg-gray-50 ${curFont === f ? 'bg-blue-50 text-[#1a73e8]' : ''}`} style={{ fontFamily: f }}>{f}</button>)}
                        </div>
                    )}
                </div>
                <Sep />

                {/* Font size */}
                <div className="relative gdoc-dd flex items-center gap-0.5">
                    <TBtn small title="Decrease" onMouseDown={e => { e.preventDefault(); const s = window.getSelection(); if (s?.rangeCount) selSave.current = s.getRangeAt(0).cloneRange() }} onClick={() => applySize(String(Math.max(6, parseInt(curSize) - 1)))}>−</TBtn>
                    <button onClick={() => toggleDd('size')} onMouseDown={e => { const s = window.getSelection(); if (s?.rangeCount) selSave.current = s.getRangeAt(0).cloneRange() }}
                        className="text-xs text-gray-700 border border-gray-300 rounded px-1 py-0.5 w-10 text-center hover:bg-gray-100 h-7 leading-none">{curSize}</button>
                    <TBtn small title="Increase" onMouseDown={e => { e.preventDefault(); const s = window.getSelection(); if (s?.rangeCount) selSave.current = s.getRangeAt(0).cloneRange() }} onClick={() => applySize(String(Math.min(96, parseInt(curSize) + 1)))}>+</TBtn>
                    {dd.size && (
                        <div className="absolute top-full left-3 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[200] w-16 max-h-48 overflow-y-auto py-1">
                            {SIZES.map(s => <button key={s} onMouseDown={e => e.preventDefault()} onClick={() => applySize(s)}
                                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${curSize === s ? 'bg-blue-50 text-[#1a73e8]' : ''}`}>{s}</button>)}
                        </div>
                    )}
                </div>
                <Sep />

                <TBtn active={fmt.bold} title="Bold (Ctrl+B)" onMouseDown={e => { e.preventDefault(); exec('bold') }}><Bold size={13} /></TBtn>
                <TBtn active={fmt.italic} title="Italic (Ctrl+I)" onMouseDown={e => { e.preventDefault(); exec('italic') }}><Italic size={13} /></TBtn>
                <TBtn active={fmt.underline} title="Underline (Ctrl+U)" onMouseDown={e => { e.preventDefault(); exec('underline') }}><UnderlineIcon size={13} /></TBtn>
                <TBtn active={fmt.strike} title="Strikethrough" onMouseDown={e => { e.preventDefault(); exec('strikeThrough') }}><Strikethrough size={13} /></TBtn>
                <Sep />

                {/* Text color */}
                <div className="relative gdoc-dd">
                    <button onMouseDown={e => { e.preventDefault(); const s = window.getSelection(); if (s?.rangeCount) selSave.current = s.getRangeAt(0).cloneRange() }}
                        onClick={() => toggleDd('textColor')} className="flex flex-col items-center justify-center w-7 h-7 hover:bg-gray-100 rounded" title="Text color">
                        <span className="text-xs font-bold" style={{ fontFamily: 'Arial', lineHeight: 1 }}>A</span>
                        <div className="w-5 h-0.5 bg-black rounded mt-0.5" />
                    </button>
                    {dd.textColor && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[200] p-2 w-52">
                            <p className="text-[10px] text-gray-500 mb-1 font-medium">Text color</p>
                            <button onMouseDown={e => e.preventDefault()} onClick={() => { exec('foreColor', '#000000'); closeAll() }} className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50 rounded mb-1">Automatic</button>
                            <div className="grid grid-cols-8 gap-0.5">{txtColors.map(c => <button key={c} onMouseDown={e => e.preventDefault()} onClick={() => { exec('foreColor', c); closeAll() }} className="w-5 h-5 rounded-sm border border-gray-100 hover:scale-110 transition-transform" style={{ backgroundColor: c }} title={c} />)}</div>
                        </div>
                    )}
                </div>

                {/* Highlight */}
                <div className="relative gdoc-dd">
                    <button onMouseDown={e => { e.preventDefault(); const s = window.getSelection(); if (s?.rangeCount) selSave.current = s.getRangeAt(0).cloneRange() }}
                        onClick={() => toggleDd('hlColor')} className="flex flex-col items-center justify-center w-7 h-7 hover:bg-gray-100 rounded" title="Highlight">
                        <PaintBucket size={12} className="text-gray-600" />
                        <div className="w-5 h-0.5 bg-yellow-400 rounded mt-0.5" />
                    </button>
                    {dd.hlColor && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[200] p-2 w-40">
                            <p className="text-[10px] text-gray-500 mb-1 font-medium">Highlight</p>
                            <button onMouseDown={e => e.preventDefault()} onClick={() => { exec('hiliteColor', 'transparent'); closeAll() }} className="w-full text-left px-2 py-1 text-xs hover:bg-gray-50 rounded mb-1">None</button>
                            <div className="grid grid-cols-7 gap-0.5">{hlColors.map(c => <button key={c} onMouseDown={e => e.preventDefault()} onClick={() => { exec('hiliteColor', c); closeAll() }} className="w-5 h-5 rounded-sm border border-gray-100 hover:scale-110" style={{ backgroundColor: c }} />)}</div>
                        </div>
                    )}
                </div>
                <Sep />

                <TBtn active={fmt.sup} title="Superscript" onMouseDown={e => { e.preventDefault(); exec('superscript') }}><Superscript size={13} /></TBtn>
                <TBtn active={fmt.sub} title="Subscript" onMouseDown={e => { e.preventDefault(); exec('subscript') }}><Subscript size={13} /></TBtn>
                <Sep />

                <TBtn active={fmt.alignL} title="Align left" onClick={() => exec('justifyLeft')}><AlignLeft size={13} /></TBtn>
                <TBtn active={fmt.alignC} title="Align center" onClick={() => exec('justifyCenter')}><AlignCenter size={13} /></TBtn>
                <TBtn active={fmt.alignR} title="Align right" onClick={() => exec('justifyRight')}><AlignRight size={13} /></TBtn>
                <TBtn active={fmt.alignJ} title="Justify" onClick={() => exec('justifyFull')}><AlignJustify size={13} /></TBtn>
                <Sep />

                {/* Line height */}
                <div className="relative gdoc-dd">
                    <button onClick={() => toggleDd('lh')} className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-gray-600" title="Line spacing">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h15v2H6zm0 7h15v2H6zm0 7h15v2H6zM2 4l3 4-3 4V4z" /></svg>
                    </button>
                    {dd.lh && <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[200] w-24 py-1">
                        {LHS.map(l => <button key={l} onClick={() => applyLH(l)} className={`w-full text-left px-4 py-1.5 text-xs hover:bg-gray-50 ${curLH === l ? 'bg-blue-50 text-[#1a73e8]' : ''}`}>{l}</button>)}
                    </div>}
                </div>
                <Sep />

                <TBtn title="Bullet list" onClick={() => exec('insertUnorderedList')}><List size={13} /></TBtn>
                <TBtn title="Numbered list" onClick={() => exec('insertOrderedList')}><ListOrdered size={13} /></TBtn>
                <Sep />
                <TBtn title="Decrease indent" onClick={() => exec('outdent')}><IndentDecrease size={13} /></TBtn>
                <TBtn title="Increase indent" onClick={() => exec('indent')}><IndentIncrease size={13} /></TBtn>
                <Sep />

                {/* Insert image */}
                <TBtn title="Insert image" onClick={() => { selSave.current = window.getSelection()?.getRangeAt(0)?.cloneRange() || null; imageInputRef.current?.click() }}><ImageIcon size={13} /></TBtn>

                {/* Table picker */}
                <div className="relative gdoc-dd">
                    <TBtn title="Insert table" onClick={() => toggleDd('tableMenu')}><TableIcon size={13} /></TBtn>
                    {dd.tableMenu && (
                        <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[200] p-2">
                            <p className="text-[10px] text-gray-500 mb-1">Insert table</p>
                            <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(10,16px)' }}>
                                {Array.from({ length: 100 }, (_, i) => {
                                    const r = Math.floor(i / 10) + 1, c = (i % 10) + 1, hl = r <= tablePick.r && c <= tablePick.c
                                    return <div key={i} onMouseEnter={() => setTablePick({ r, c })} onClick={() => { insertTable(r, c); closeAll(); setTablePick({ r: 0, c: 0 }) }}
                                        className={`w-3.5 h-3.5 border rounded-sm cursor-pointer transition-colors ${hl ? 'bg-blue-200 border-blue-400' : 'bg-gray-50 border-gray-200 hover:bg-blue-50'}`} />
                                })}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1 text-center">{tablePick.r > 0 ? `${tablePick.r} × ${tablePick.c}` : 'Hover to select'}</p>
                        </div>
                    )}
                </div>

                <TBtn title="Insert link" onClick={insertLink}><LinkIcon size={13} /></TBtn>
                <Sep />
                <TBtn title="Clear formatting" onClick={() => exec('removeFormat')}><X size={12} className="text-gray-500" /></TBtn>
                <TBtn title="Find & replace" onClick={() => setDd(p => ({ ...p, findReplace: true }))}><Search size={13} /></TBtn>
                <TBtn title="Page setup / margins" onClick={() => { closeAll(); setShowPageSettings(true) }}><Layout size={13} /></TBtn>

                {/* Table context toolbar */}
                {selTable && selCell && (
                    <>
                        <Sep />
                        <div className="flex items-center gap-0.5 bg-blue-50 rounded px-1 py-0.5 border border-blue-200 gdoc-dd">
                            <span className="text-[10px] text-blue-600 font-semibold mr-1">Table:</span>
                            <TBtn small title="Add row below" onClick={() => { const row = selCell.parentElement as HTMLTableRowElement; const nr = selTable.insertRow(row.rowIndex + 1); for (let i = 0; i < (selTable.rows[0]?.cells.length || 1); i++) { const c = nr.insertCell(); c.innerHTML = '<p style="margin:0;"><br></p>'; c.style.cssText = 'border:1px solid #c7c7c7;padding:6px 8px;min-width:40px;vertical-align:top;' }; triggerSave() }}>+R</TBtn>
                            <TBtn small title="Add column right" onClick={() => { const idx = selCell.cellIndex; Array.from(selTable.rows).forEach(row => { const c = row.insertCell(idx + 1); c.innerHTML = '<p style="margin:0;"><br></p>'; c.style.cssText = 'border:1px solid #c7c7c7;padding:6px 8px;min-width:40px;vertical-align:top;' }); triggerSave() }}>+C</TBtn>
                            <div className="relative gdoc-dd">
                                <button onClick={() => toggleDd('tableCellColor')} className="px-1 py-0.5 text-[10px] hover:bg-blue-100 rounded text-blue-700 font-medium">Fill</button>
                                {dd.tableCellColor && <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-xl z-[200] p-1.5">
                                    <div className="grid grid-cols-5 gap-0.5">
                                        {['#ffffff', '#f8f9fa', '#fee2e2', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#fff3e0', '#e8eaf6', '#000000'].map(c => (
                                            <button key={c} onMouseDown={e => e.preventDefault()} onClick={() => { selCell.style.backgroundColor = c; closeAll(); triggerSave() }} className="w-5 h-5 rounded border border-gray-200 hover:scale-110" style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                </div>}
                            </div>
                            <TBtn small title="Delete row" onClick={() => { const r = selCell.parentElement as HTMLTableRowElement; selTable.deleteRow(r.rowIndex); setSelCell(null); triggerSave() }}><span className="text-red-500">−R</span></TBtn>
                            <TBtn small title="Delete column" onClick={() => { const idx = selCell.cellIndex; Array.from(selTable.rows).forEach(r => { if (r.cells[idx]) r.deleteCell(idx) }); setSelCell(null); triggerSave() }}><span className="text-red-500">−C</span></TBtn>
                            <TBtn small title="Delete table" onClick={() => { selTable.remove(); setSelTable(null); setSelCell(null); triggerSave() }}><Trash2 size={11} className="text-red-500" /></TBtn>
                        </div>
                    </>
                )}
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
                {/* Outline panel */}
                {dd.outline && (
                    <div className="w-52 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0 py-4 px-3">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Document Outline</p>
                        {outlineItems.length === 0 ? <p className="text-xs text-gray-400">Add headings to see an outline</p>
                            : outlineItems.map(item => <button key={item.id} onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                                className="w-full text-left text-xs text-gray-700 hover:text-[#1a73e8] py-1 truncate block" style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>{item.text}</button>)}
                    </div>
                )}

                {/* Editor canvas — pages as visual blocks with gaps */}
                <div className="flex-1 overflow-y-auto overflow-x-auto py-8 px-4" style={{ backgroundColor: '#f8f9fa' }}>
                    <style>{`
                        #gdoc-editor { outline: none; caret-color: #000; user-select: text; -webkit-user-select: text; }
                        #gdoc-editor p { margin: 0; min-height: 1.3em; }
                        #gdoc-editor ul, #gdoc-editor ol { padding-left: 2em; margin: 0 0 4px; }
                        #gdoc-editor li { margin-bottom: 2px; }
                        #gdoc-editor h1 { font-size: 20pt; font-weight: bold; margin: 14pt 0 6pt; line-height: 1.2; }
                        #gdoc-editor h2 { font-size: 16pt; font-weight: bold; margin: 12pt 0 5pt; }
                        #gdoc-editor h3 { font-size: 13pt; font-weight: bold; margin: 10pt 0 4pt; }
                        #gdoc-editor h4 { font-size: 12pt; font-weight: bold; margin: 8pt 0 3pt; }
                        #gdoc-editor h5 { font-size: 11pt; font-weight: bold; margin: 6pt 0; }
                        #gdoc-editor h6 { font-size: 10pt; font-weight: bold; margin: 4pt 0; }
                        #gdoc-editor a { color: #1155cc; text-decoration: underline; }
                        #gdoc-editor blockquote { border-left: 3px solid #c7c7c7; margin: 8px 0 8px 20px; padding-left: 12px; color: #555; font-style: italic; }
                        #gdoc-editor table { border-collapse: collapse; width: 100%; margin: 8px 0; }
                        #gdoc-editor td, #gdoc-editor th { border: 1px solid #c7c7c7; padding: 6px 8px; min-width: 30px; vertical-align: top; word-break: break-word; }
                        #gdoc-editor td > p, #gdoc-editor th > p { margin: 0; min-height: 1em; }
                        #gdoc-editor img { max-width: 100%; height: auto; }
                        #gdoc-editor hr { border: none; border-top: 2px solid #e0e0e0; margin: 16px 0; }
                        #gdoc-editor .gdoc-img-wrapper { display: inline-block; position: relative; cursor: default; vertical-align: bottom; }
                        #gdoc-editor .gdoc-img-wrapper img { display: block; width: 100%; height: 100%; object-fit: contain; }
                        #gdoc-editor .pdf-page-img { display: block; width: 100%; line-height: 0; }
                        #gdoc-editor .pdf-page-img + div { display: block; }
                        /* Page Break Visualization with Margins */
                        .gdoc-page-break {
                            display: block;
                            height: calc(var(--pb) + var(--pt) + 24px);
                            margin-left: calc(var(--pl) * -1);
                            margin-right: calc(var(--pr) * -1);
                            width: calc(100% + var(--pl) + var(--pr));
                            position: relative;
                            background-color: transparent; /* Shows white paper background for margins */
                            user-select: none;
                            pointer-events: none; /* Let clicks pass through if needed, but mainly specific for editing */
                        }
                        /* The visual gray gap */
                        .gdoc-page-break::after {
                            content: "";
                            position: absolute;
                            top: var(--pb);
                            height: 24px;
                            left: 0;
                            right: 0;
                            background-color: #f8f9fa;
                            border-top: 1px solid #e0e0e0;
                            border-bottom: 1px solid #e0e0e0;
                            box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
                        }
                    `}</style>

                    <div className="flex flex-col items-center gap-0 mx-auto" style={{ width: 'fit-content' }}>
                        {/* The page — white paper on gray background */}
                        <div className="bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.09)] relative"
                            style={{ width: pgW, minHeight: pgH }}>
                            {/* Page number indicator */}
                            <div className="absolute -top-6 left-0 text-[10px] text-gray-400 select-none pointer-events-none">Page 1</div>

                            <div id="gdoc-editor" ref={editorRef}
                                contentEditable suppressContentEditableWarning spellCheck
                                onInput={onInput} onKeyDown={onKeyDown} onPaste={onPaste} onClick={onClick}
                                className="text-gray-900 focus:outline-none"
                                style={{
                                    fontFamily: 'Arial, sans-serif', fontSize: '11pt', lineHeight: '1.15',
                                    '--pl': `${ml}px`, '--pr': `${mr}px`, '--pt': `${mt}px`, '--pb': `${mb}px`,
                                    padding: `var(--pt) var(--pr) var(--pb) var(--pl)`,
                                    minHeight: pgH, wordBreak: 'break-word', overflowWrap: 'break-word',
                                } as any}
                            />
                        </div>

                        {/* Page break divider — visual gray gap between pages in PDF */}
                        <style>{`
                            #gdoc-editor .pdf-page-img + div[style*="height:1px"] {
                                display: block;
                                height: 24px !important;
                                background: #f8f9fa !important;
                                margin: 0 !important;
                            }
                        `}</style>

                        {/* Footer info */}
                        <div className="mt-4 flex items-center gap-6 pb-4 text-xs text-gray-400">
                            <button onClick={() => setDd(p => ({ ...p, wordCount: true }))} className="hover:text-gray-600 transition-colors">{wordCount} words · {charCount} chars</button>
                            <button onClick={() => { closeAll(); setShowPageSettings(true) }} className="hover:text-gray-600 transition-colors flex items-center gap-1"><Layout size={11} />{pageSettings.size.toUpperCase()} · margins {pageSettings.marginTop}px</button>
                            <div className="flex items-center gap-1">
                                <TBtn small title="Zoom out" onClick={() => setZoom(z => Math.max(50, z - 10))}><ZoomOut size={11} /></TBtn>
                                <span className="w-8 text-center font-mono">{zoom}%</span>
                                <TBtn small title="Zoom in" onClick={() => setZoom(z => Math.min(200, z + 10))}><ZoomIn size={11} /></TBtn>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Image resize overlay */}
            {selImg && imgOverlay && (
                <div className="fixed pointer-events-none z-[300]" style={{ top: imgOverlay.top, left: imgOverlay.left, width: imgOverlay.w, height: imgOverlay.h }}>
                    <div className="absolute inset-0 border-2 border-[#1a73e8]" />
                    <div className="absolute -bottom-5 left-0 bg-[#1a73e8] text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">{Math.round(imgOverlay.w)} × {Math.round(imgOverlay.h)}</div>
                    {/* Image action toolbar */}
                    <div className="absolute -top-8 left-0 bg-white border border-gray-200 rounded shadow-lg flex items-center gap-0.5 px-1.5 py-1 pointer-events-auto z-[302]">
                        <span className="text-[9px] text-gray-500 mr-1 font-medium">Image:</span>
                        <input type="number" value={Math.round(selImg.offsetWidth)} min={40}
                            onChange={e => { if (selImg) { selImg.style.width = e.target.value + 'px'; selImg.style.height = 'auto'; updateImgOverlay() } }}
                            className="w-12 text-[9px] border border-gray-200 rounded px-1 py-0.5 text-center" />
                        <span className="text-[9px] text-gray-400">×</span>
                        <input type="number" value={Math.round(selImg.offsetHeight)} min={40}
                            onChange={e => { if (selImg) { selImg.style.height = e.target.value + 'px'; updateImgOverlay() } }}
                            className="w-12 text-[9px] border border-gray-200 rounded px-1 py-0.5 text-center" />
                        <button onClick={() => exec('justifyLeft')} className="text-[9px] px-1.5 py-0.5 hover:bg-gray-100 rounded">Left</button>
                        <button onClick={() => exec('justifyCenter')} className="text-[9px] px-1.5 py-0.5 hover:bg-gray-100 rounded">Center</button>
                        <button onClick={() => { selImg?.remove(); setSelImg(null); setImgOverlay(null); triggerSave() }}
                            className="p-0.5 hover:bg-red-50 rounded text-red-400 ml-1"><Trash2 size={11} /></button>
                    </div>
                    {/* 8 resize handles */}
                    {[{ h: 'nw', s: { top: -5, left: -5 } }, { h: 'n', s: { top: -5, left: 'calc(50% - 5px)' } }, { h: 'ne', s: { top: -5, right: -5 } },
                    { h: 'e', s: { top: 'calc(50% - 5px)', right: -5 } }, { h: 'se', s: { bottom: -5, right: -5 } },
                    { h: 's', s: { bottom: -5, left: 'calc(50% - 5px)' } }, { h: 'sw', s: { bottom: -5, left: -5 } },
                    { h: 'w', s: { top: 'calc(50% - 5px)', left: -5 } }].map(({ h, s }) => (
                        <div key={h} className="absolute w-2.5 h-2.5 bg-white border-2 border-[#1a73e8] rounded-sm pointer-events-auto gdoc-resize-handle z-[301]"
                            style={{ ...s as any, cursor: `${h}-resize` }} onMouseDown={e => startResize(e, h)} />
                    ))}
                </div>
            )}

            {/* Find & Replace */}
            {dd.findReplace && (
                <div className="fixed top-20 right-6 z-[400] bg-white border border-gray-200 rounded-lg shadow-2xl p-4" style={{ width: 300 }}>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-800">Find and replace</h3>
                        <button onClick={closeAll} className="p-1 hover:bg-gray-100 rounded"><X size={14} /></button>
                    </div>
                    <div className="space-y-2 mb-3">
                        <input value={findText} onChange={e => setFindText(e.target.value)} onKeyDown={e => e.key === 'Enter' && doFind()} placeholder="Search…"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:border-[#1a73e8] focus:outline-none" />
                        <input value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="Replace with…"
                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:border-[#1a73e8] focus:outline-none" />
                    </div>
                    {findCount > 0 && <p className="text-xs text-gray-500 mb-2">{findCount} match{findCount !== 1 ? 'es' : ''}</p>}
                    <div className="flex gap-2">
                        <button onClick={doFind} className="flex-1 px-3 py-1.5 text-sm font-medium text-[#1a73e8] border border-[#1a73e8] rounded hover:bg-blue-50">Find</button>
                        <button onClick={doReplaceAll} className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-[#1a73e8] rounded hover:bg-[#1557b0]">Replace all</button>
                    </div>
                </div>
            )}

            {/* Page Setup Modal */}
            {showPageSettings && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/30" onClick={() => setShowPageSettings(false)}>
                    <div className="bg-white rounded-lg shadow-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-base font-semibold text-gray-800">Page setup</h3>
                            <button onClick={() => setShowPageSettings(false)} className="p-1 hover:bg-gray-100 rounded"><X size={15} /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">Page size</label>
                                    <select value={pageSettings.size} onChange={e => setPageSettings(p => ({ ...p, size: e.target.value as any }))}
                                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:border-[#1a73e8] focus:outline-none">
                                        <option value="letter">US Letter (8.5×11")</option>
                                        <option value="a4">A4 (210×297mm)</option>
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
                                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Margins — 96px = 1 inch</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {([['marginTop', 'Top'], ['marginBottom', 'Bottom'], ['marginLeft', 'Left'], ['marginRight', 'Right']] as const).map(([key, label]) => (
                                        <div key={key}>
                                            <label className="text-[10px] text-gray-500 mb-0.5 block">{label}</label>
                                            <div className="flex items-center gap-1">
                                                <input type="number" value={pageSettings[key]} min={0} max={300}
                                                    onChange={e => setPageSettings(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                                                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:border-[#1a73e8] focus:outline-none" />
                                                <span className="text-[10px] text-gray-400">px</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {/* Visual margin diagram */}
                                <div className="mt-3 flex justify-center">
                                    <div className="relative bg-white border-2 border-gray-300 shadow" style={{ width: 80, height: 100 }}>
                                        <div className="absolute border border-dashed border-blue-400 pointer-events-none"
                                            style={{
                                                top: Math.max(2, pageSettings.marginTop / 12), bottom: Math.max(2, pageSettings.marginBottom / 12),
                                                left: Math.max(2, pageSettings.marginLeft / 12), right: Math.max(2, pageSettings.marginRight / 12)
                                            }} />
                                        <div className="absolute inset-0 flex items-center justify-center text-center pointer-events-none">
                                            <div className="text-[7px] text-gray-400 leading-tight">
                                                <div className="mb-0.5">T:{pageSettings.marginTop}</div>
                                                <div className="flex justify-between w-10 mx-auto"><span>L:{pageSettings.marginLeft}</span><span>R:{pageSettings.marginRight}</span></div>
                                                <div className="mt-0.5">B:{pageSettings.marginBottom}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5 justify-end">
                            <button onClick={() => setShowPageSettings(false)} className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded">Cancel</button>
                            <button onClick={() => setShowPageSettings(false)} className="px-4 py-2 text-sm text-white bg-[#1a73e8] hover:bg-[#1557b0] rounded">OK</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Word Count Modal */}
            {dd.wordCount && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/30" onClick={closeAll}>
                    <div className="bg-white rounded-lg shadow-2xl p-6 w-60" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-gray-800">Word count</h3>
                            <button onClick={closeAll} className="p-1 hover:bg-gray-100 rounded"><X size={14} /></button>
                        </div>
                        <div className="space-y-2">
                            {[['Words', wordCount], ['Characters (with spaces)', charCount], ['Characters (no spaces)', charCount - (editorRef.current?.innerText.match(/ /g) || []).length]].map(([l, v]) => (
                                <div key={String(l)} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                                    <span className="text-sm text-gray-600">{l}</span>
                                    <span className="text-sm font-semibold text-gray-800">{Number(v).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                        <button onClick={closeAll} className="w-full mt-4 px-4 py-2 text-sm text-[#1a73e8] border border-[#1a73e8] rounded hover:bg-blue-50">OK</button>
                    </div>
                </div>
            )}

            {/* Hidden inputs */}
            <input ref={imageInputRef} type="file" className="hidden" accept="image/*" onChange={onImageFile} />
            <input ref={docInputRef} type="file" className="hidden"
                accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                onChange={handleFileUpload} />
        </div>
    )
}