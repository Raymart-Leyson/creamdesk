"use client"
import { useState } from 'react'
import { CreamButton } from '@/components/ui/CreamComponents'
import { supabase } from '@/lib/supabase'
import { FileText, Loader2, CheckCircle } from 'lucide-react'

export default function PdfApp({ workspaceId }: { workspaceId?: string }) {
    const [uploading, setUploading] = useState(false)
    const [processing, setProcessing] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!workspaceId) {
            setError('Please open PDF Tool from a specific Workspace to process files.')
            return
        }

        setUploading(true)
        setError(null)
        setSuccess(false)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('Not logged in')

            const filePath = `${user.id}/${Date.now()}-${file.name}`

            // Upload
            const { error: uploadError } = await supabase.storage
                .from('pdfs')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            setUploading(false)
            setProcessing(true)

            // Get Session Token for API Auth
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('No session')

            // Call API
            const response = await fetch('/api/pdf/process', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ filePath, workspaceId: workspaceId })
            })

            if (!response.ok) {
                const errData = await response.json()
                throw new Error(errData.error || 'Failed to process PDF')
            }

            setProcessing(false)
            setSuccess(true)

        } catch (err: any) {
            console.error(err)
            setError(err.message)
            setUploading(false)
            setProcessing(false)
        }
    }

    return (
        <div className="flex flex-col h-full bg-[var(--bg-cream)] p-6 items-center justify-center border-4 border-dashed border-[var(--accent-espresso)]/20 rounded-2xl m-4 relative overflow-hidden">
            {success ? (
                <div className="text-center animate-in zoom-in duration-300">
                    <CheckCircle size={64} className="text-green-500 mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Success!</h3>
                    <p className="opacity-70 mb-4">PDF processed into notes & tasks.</p>
                    <CreamButton onClick={() => setSuccess(false)}>Process Another</CreamButton>
                </div>
            ) : (
                <>
                    <div className={`transition-all duration-300 ${uploading || processing ? 'scale-90 opacity-50 blur-sm' : 'scale-100 opacity-100'}`}>
                        <div className="text-6xl mb-4 mx-auto text-center">📄</div>
                        <h3 className="font-bold text-lg mb-2 text-center">
                            {workspaceId ? 'Upload & Process PDF' : 'Select a Workspace First'}
                        </h3>
                        <p className="text-sm opacity-60 mb-6 text-center max-w-xs">
                            File will be uploaded to Supabase Storage and processed by AI.
                        </p>

                        {workspaceId && (
                            <>
                                <input
                                    type="file"
                                    id="pdf-upload"
                                    className="hidden"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    disabled={uploading || processing}
                                />
                                <CreamButton onClick={() => document.getElementById('pdf-upload')?.click()} className="mx-auto block">
                                    Select PDF File
                                </CreamButton>
                            </>
                        )}
                    </div>

                    {(uploading || processing) && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 backdrop-blur-sm z-10">
                            <Loader2 size={48} className="animate-spin text-[var(--accent-espresso)] mb-4" />
                            <p className="font-bold text-[var(--accent-espresso)] animate-pulse">
                                {uploading ? 'Uploading...' : 'AI Processing...'}
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute bottom-4 left-4 right-4 bg-red-100 border-2 border-red-400 text-red-800 p-3 rounded-xl text-center text-sm font-bold">
                            {error}
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
