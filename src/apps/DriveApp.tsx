"use client"
import { useEffect, useState } from 'react'
import { CreamButton } from '@/components/ui/CreamComponents'
import { supabase } from '@/lib/supabase'
import { HardDrive, File, FileText, Download, Trash2, Loader2, Plus, LogIn, ExternalLink } from 'lucide-react'

interface DriveFile {
    id: string
    name: string
    size: number
    type: string
    url: string
    created_at: string
    source: 'supabase' | 'google'
    iconLink?: string
    thumbnailLink?: string
}

export default function DriveApp() {
    const [files, setFiles] = useState<DriveFile[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)

    useEffect(() => {
        fetchFiles()
    }, [])

    const fetchFiles = async () => {
        setLoading(true)
        try {
            const { data: supabaseData, error } = await supabase
                .from('files')
                .select('*')
                .order('created_at', { ascending: false })

            if (error) console.error("Supabase fetch error:", error)

            const localFiles: DriveFile[] = (supabaseData || []).map((f: any) => ({
                ...f,
                source: 'supabase'
            }))

            setFiles(localFiles)

        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }



    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("No user")

            const filePath = `${user.id}/${Date.now()}-${file.name}`

            // Upload to Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('drive')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage.from('drive').getPublicUrl(filePath)

            // Save to DB
            const { error: dbError } = await supabase.from('files').insert({
                user_id: user.id,
                name: file.name,
                size: file.size,
                type: file.type,
                url: publicUrl
            })

            if (dbError) throw dbError

            fetchFiles()
        } catch (e) {
            console.error(e)
            alert("Upload failed")
        } finally {
            setUploading(false)
        }
    }

    const handleDelete = async (id: string, source: 'supabase' | 'google') => {
        if (source === 'google') {
            alert("Please delete Google Drive files directly in Google Drive.")
            return
        }

        if (!confirm("Delete this file?")) return
        try {
            await supabase.from('files').delete().eq('id', id)
            fetchFiles()
        } catch (e) {
            console.error(e)
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '-'
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-cream)]">
            <div className="p-4 border-b-2 border-[var(--accent-espresso)] flex justify-between items-center bg-[var(--bg-surface)] sticky top-0 z-10 shrink-0">
                <h2 className="font-bold text-lg flex items-center gap-2 text-[var(--accent-espresso)]">
                    <HardDrive size={20} /> My Drive
                </h2>

                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        id="drive-upload"
                        className="hidden"
                        onChange={handleUpload}
                        disabled={uploading}
                    />
                    <CreamButton
                        onClick={() => document.getElementById('drive-upload')?.click()}
                        className="py-1 px-3 text-sm flex items-center gap-1"
                        disabled={uploading}
                    >
                        {uploading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Upload
                    </CreamButton>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 grid gap-3 content-start custom-scrollbar">
                {loading ? (
                    <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[var(--accent-espresso)]" /></div>
                ) : files.length === 0 ? (
                    <div className="text-center opacity-50 py-10">
                        <HardDrive size={48} className="mx-auto mb-2 opacity-20" />
                        <p>Your drive is empty. Connect Google Drive or upload files.</p>
                    </div>
                ) : (
                    files.map((file) => (
                        <div
                            key={file.id}
                            onClick={() => window.open(file.url, '_blank')}
                            className="bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] p-3 rounded-xl shadow-[2px_2px_0px_var(--accent-espresso)] flex items-center gap-3 group hover:shadow-[4px_4px_0px_var(--accent-espresso)] transition-all cursor-pointer hover:bg-[var(--accent-espresso)]/5"
                        >
                            <div className="p-3 bg-[var(--bg-surface)] text-[var(--accent-espresso)] rounded-lg border-2 border-[var(--accent-espresso)]/20 relative overflow-hidden flex items-center justify-center w-12 h-12 shrink-0">
                                {file.iconLink ? (
                                    <img src={file.iconLink} alt="" className="w-6 h-6 object-contain" />
                                ) : file.type.includes('image') ? (
                                    <img src={file.url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <FileText size={20} />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm truncate text-[var(--accent-espresso)] flex items-center gap-2">
                                    {file.name}
                                    {file.source === 'google' && <span className="text-[10px] bg-[var(--accent-espresso)]/10 text-[var(--accent-espresso)] px-1 rounded border border-[var(--accent-espresso)]/20">Google</span>}
                                </h4>
                                <p className="text-xs opacity-50">{formatSize(file.size)} • {new Date(file.created_at).toLocaleDateString()}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={file.source === 'supabase'}
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-2 hover:bg-[var(--bg-surface)] rounded-lg text-[var(--accent-espresso)]"
                                    title="Open / Download"
                                >
                                    {file.source === 'google' ? <ExternalLink size={16} /> : <Download size={16} />}
                                </a>
                                {file.source === 'supabase' && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(file.id, file.source); }}
                                        className="p-2 hover:bg-[var(--bg-surface)] rounded-lg text-[var(--accent-peach)]"
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
