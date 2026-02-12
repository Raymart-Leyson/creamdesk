import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { CreamButton } from '@/components/ui/CreamComponents'

import { useDesktopStore } from '@/store/useStore'

export default function SettingsApp() {
    const { theme, setTheme } = useDesktopStore()
    const router = useRouter()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        <div className="p-6 flex flex-col items-start gap-4 h-full">
            <h2 className="text-xl font-bold">Settings</h2>
            <div className="flex-1 w-full bg-[var(--bg-surface)]/50 rounded-xl p-4">
                <div className="py-2 border-b border-[var(--accent-espresso)]/10">
                    <label className="font-bold block mb-1">Theme</label>
                    <select
                        value={theme}
                        onChange={(e) => setTheme(e.target.value as any)}
                        className="w-full p-2 rounded-lg bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] text-[var(--accent-espresso)]"
                    >
                        <option value="cream">Cream (Default)</option>
                        <option value="dark-choco">Dark Choco</option>
                    </select>
                </div>
            </div>
            <CreamButton onClick={handleLogout} variant="secondary" className="w-full">
                Logout
            </CreamButton>
        </div>
    )
}
