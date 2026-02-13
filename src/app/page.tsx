"use client"

import Link from 'next/link'
import { motion } from 'framer-motion'
import { CreamButton, CreamCard } from '@/components/ui/CreamComponents'
import { HardDrive, Calendar, FileText, PenTool, Sparkles, Zap, Shield, CheckCircle2, ArrowRight } from 'lucide-react'

export default function Home() {
  const features = [
    { icon: HardDrive, title: "File Upload", desc: "Upload and manage your documents in one place." },
    { icon: Calendar, title: "Calendar Sync", desc: "See your upcoming events at a glance." },
    { icon: FileText, title: "AI PDF Tools", desc: "Turn PDFs into summaries, tasks & flashcards." },
    { icon: PenTool, title: "Smart Notes", desc: "Jot down ideas linked to your projects." },
  ]

  const benefits = [
    { icon: Sparkles, title: "AI-Powered", desc: "Smart features that learn from your workflow" },
    { icon: Zap, title: "Lightning Fast", desc: "Desktop-like performance in your browser" },
    { icon: Shield, title: "Secure & Private", desc: "Your data is encrypted and protected" },
  ]

  const highlights = [
    "No credit card required",
    "40 free AI tokens to start",
    "Daily login streak rewards",
    "Desktop-style workspace"
  ]

  return (
    <div className="min-h-screen bg-[var(--bg-cream)] flex flex-col font-sans selection:bg-[var(--accent-peach)] selection:text-[var(--accent-espresso)]">

      {/* Navbar */}
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full sticky top-0 bg-[var(--bg-cream)]/95 backdrop-blur-sm z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--accent-espresso)] rounded-lg transform rotate-3" />
          <span className="font-black text-2xl tracking-tighter text-[var(--accent-espresso)]">CreamDesk</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login">
            <CreamButton variant="secondary" className="px-6">Log In</CreamButton>
          </Link>
          <Link href="/login">
            <CreamButton className="px-6">Sign Up</CreamButton>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-7xl mx-auto w-full py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-20"
        >
          <div className="inline-block mb-6 px-4 py-2 bg-[var(--accent-peach)]/20 border-2 border-[var(--accent-espresso)] rounded-full">
            <span className="text-sm font-bold text-[var(--accent-espresso)]">✨ Your productivity hub, reimagined</span>
          </div>

          <h1 className="text-6xl md:text-7xl lg:text-8xl font-black text-[var(--accent-espresso)] mb-8 leading-[1.1]">
            Your messy digital life,<br />
            <span className="relative inline-block">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent-espresso)] to-[var(--accent-peach)]">organized.</span>
              <div className="absolute -bottom-2 left-0 right-0 h-3 bg-[var(--accent-peach)]/30 -rotate-1"></div>
            </span>
          </h1>

          <p className="text-xl md:text-2xl lg:text-3xl text-[var(--accent-espresso)]/80 max-w-4xl mx-auto mb-8 font-medium leading-relaxed">
            Connect Calendar & Tasks into one beautiful,<br className="hidden md:block" /> desktop-style workspace. <span className="font-black text-[var(--accent-espresso)]">Powered by AI.</span>
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {highlights.map((highlight, i) => (
              <div key={i} className="flex items-center gap-2 text-sm font-bold text-[var(--accent-espresso)]">
                <CheckCircle2 size={18} className="text-green-600" />
                {highlight}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Link href="/login">
              <CreamButton className="text-xl py-5 px-14 shadow-[6px_6px_0px_var(--accent-espresso)] hover:shadow-[8px_8px_0px_var(--accent-espresso)] hover:-translate-y-1 flex items-center gap-2">
                Get Started Free
                <ArrowRight size={20} />
              </CreamButton>
            </Link>
          </div>
        </motion.div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-20 max-w-5xl">
          {benefits.map((benefit, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="p-8 bg-[var(--bg-surface)] border-2 border-[var(--accent-espresso)] rounded-2xl hover:-translate-y-2 hover:shadow-[6px_6px_0px_var(--accent-espresso)] transition-all">
                <benefit.icon className="w-10 h-10 text-[var(--accent-espresso)] mb-4" />
                <h3 className="text-xl font-bold mb-2 text-[var(--accent-espresso)]">{benefit.title}</h3>
                <p className="text-sm opacity-70 text-[var(--accent-espresso)] leading-relaxed">{benefit.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Features Section */}
        <div className="w-full mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-[var(--accent-espresso)] mb-4 text-center">Everything you need</h2>
          <p className="text-lg text-[var(--accent-espresso)]/70 mb-12 text-center max-w-2xl mx-auto">
            All your essential tools in one place, designed to help you stay organized and productive.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <CreamCard className="h-full hover:-translate-y-2 hover:shadow-[8px_8px_0px_var(--accent-espresso)] transition-all bg-white">
                  <div className="mb-4 bg-[var(--bg-cream)] w-14 h-14 rounded-xl border-2 border-[var(--accent-espresso)] flex items-center justify-center shadow-[2px_2px_0px_var(--accent-espresso)]">
                    <feature.icon className="text-[var(--accent-espresso)]" size={24} />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-[var(--accent-espresso)]">{feature.title}</h3>
                  <p className="text-sm opacity-70 leading-relaxed text-[var(--accent-espresso)]">
                    {feature.desc}
                  </p>
                </CreamCard>
              </motion.div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="w-full max-w-4xl bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-cream)] border-4 border-[var(--accent-espresso)] rounded-3xl p-12 shadow-[8px_8px_0px_var(--accent-espresso)] mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-black text-[var(--accent-espresso)] mb-4">Ready to get organized?</h2>
          <p className="text-xl text-[var(--accent-espresso)]/80 mb-8">Join thousands of users who've transformed their digital workflow.</p>
          <Link href="/login">
            <CreamButton className="text-xl py-5 px-14 shadow-[6px_6px_0px_var(--accent-espresso)] hover:shadow-[8px_8px_0px_var(--accent-espresso)] hover:-translate-y-1">
              Start Free Today
            </CreamButton>
          </Link>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t-2 border-[var(--accent-espresso)]/10 py-8 text-center bg-[var(--bg-surface)]">
        <p className="text-[var(--accent-espresso)]/60 font-bold text-sm">
          © {new Date().getFullYear()} CreamDesk. Built with ❤️ + ☕️.
        </p>
      </footer>
    </div>
  )
}
