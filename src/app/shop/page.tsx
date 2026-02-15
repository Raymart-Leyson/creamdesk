"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CreamButton, CreamCard } from '@/components/ui/CreamComponents'
import { Coins, Zap, Star, Crown, Facebook, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function ShopPage() {
    const [selectedPackage, setSelectedPackage] = useState<string | null>(null)
    const [isInternational, setIsInternational] = useState(false)

    const packages = [
        {
            id: 'exam-cram',
            name: 'Exam Cram',
            tokens: 100,
            pricePHP: 50,
            priceUSD: 1,
            pricePerToken: 0.50,
            description: "Perfect for one exam week",
            discount: null,
            icon: Zap,
            color: 'from-blue-50 to-cyan-50',
            borderColor: 'border-blue-500',
            popular: false
        },
        {
            id: 'daily-driver',
            name: 'Daily Driver',
            tokens: 500,
            pricePHP: 250,
            priceUSD: 5,
            pricePerToken: 0.50,
            description: "Your monthly allowance",
            discount: null,
            icon: Coins,
            color: 'from-purple-50 to-pink-50',
            borderColor: 'border-purple-500',
            popular: false
        },
        {
            id: 'scholar',
            name: 'Scholar Pack',
            tokens: 1200,
            pricePHP: 499,
            priceUSD: 9,
            pricePerToken: 0.41,
            description: "Best for serious students",
            discount: 'BEST VALUE',
            icon: Star,
            color: 'from-orange-50 to-yellow-50',
            borderColor: 'border-orange-500',
            popular: true
        },
        {
            id: 'semester',
            name: 'Semester Pass',
            tokens: 6000,
            pricePHP: 1999,
            priceUSD: 35,
            pricePerToken: 0.33,
            description: "Cover the whole semester",
            discount: 'HUGE SAVINGS',
            icon: Crown,
            color: 'from-yellow-50 to-amber-50',
            borderColor: 'border-yellow-600',
            popular: false
        }
    ]

    return (
        <div className="min-h-screen bg-[var(--bg-cream)] p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <Link href="/desktop">
                        <CreamButton variant="secondary" className="mb-4 flex items-center gap-2">
                            <ArrowLeft size={16} />
                            Back to Desktop
                        </CreamButton>
                    </Link>
                    <h1 className="text-5xl font-black text-[var(--accent-espresso)] mb-2">Token Shop</h1>
                    <p className="text-lg text-[var(--accent-espresso)]/70">Power up your AI features with token packages</p>
                </div>

                {/* Monthly Plans */}
                <div className="mb-12">
                    <h2 className="text-3xl font-black text-[var(--accent-espresso)] mb-2 flex items-center gap-2">
                        <Star className="fill-yellow-400 text-yellow-600" />
                        Monthly Plans
                    </h2>
                    <p className="text-[var(--accent-espresso)]/70 mb-6 max-w-2xl">
                        Get the best value with a monthly allowance. Perfect for consistent study habits and full access to daily features.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {packages.filter(p => ['scholar', 'daily-driver', 'semester'].includes(p.id)).map((pkg, i) => (
                            <motion.div
                                key={pkg.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="relative"
                            >
                                {pkg.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-[var(--accent-espresso)] text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                                        MOST POPULAR
                                    </div>
                                )}
                                {pkg.discount && (
                                    <div className="absolute -top-3 -right-3 z-10 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg border-2 border-white">
                                        {pkg.discount}
                                    </div>
                                )}
                                <CreamCard
                                    className={`h-full cursor-pointer transition-all ${selectedPackage === pkg.id
                                        ? 'ring-4 ring-[var(--accent-espresso)] -translate-y-2'
                                        : 'hover:-translate-y-1'
                                        } ${pkg.popular ? 'border-4' : ''}`}
                                    onClick={() => setSelectedPackage(pkg.id)}
                                >
                                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${pkg.color} border-2 ${pkg.borderColor} flex items-center justify-center mb-4 shadow-[2px_2px_0px_var(--accent-espresso)]`}>
                                        <pkg.icon className="text-[var(--accent-espresso)]" size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-[var(--accent-espresso)] mb-2">{pkg.name}</h3>
                                    <div className="text-4xl font-black text-[var(--accent-espresso)] mb-1">
                                        {pkg.tokens}
                                        <span className="text-lg font-bold ml-1">tokens</span>
                                    </div>
                                    <div className="text-2xl font-bold text-[var(--accent-peach)] mb-2">
                                        ₱{pkg.pricePHP}
                                        <span className="text-sm text-[var(--accent-espresso)]/60 font-bold ml-1">
                                            {pkg.id === 'semester' ? '/sem' : '/mo'}
                                        </span>
                                    </div>
                                    <div className="text-xs text-[var(--accent-espresso)]/60 font-bold mb-1">
                                        ₱{pkg.pricePerToken.toFixed(2)} per token
                                    </div>
                                    <div className="text-sm text-[var(--accent-espresso)]/60 font-medium">
                                        {pkg.description}
                                    </div>
                                </CreamCard>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Token Top-ups */}
                <div className="mb-12">
                    <h2 className="text-3xl font-black text-[var(--accent-espresso)] mb-2 flex items-center gap-2">
                        <Zap className="fill-blue-400 text-blue-600" />
                        One-Time Top-ups
                    </h2>
                    <p className="text-[var(--accent-espresso)]/70 mb-6 max-w-2xl">
                        Need a quick boost? Grab a one-time pack for exam weeks or special projects.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {packages.filter(p => ['exam-cram'].includes(p.id)).map((pkg, i) => (
                            <motion.div
                                key={pkg.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="relative"
                            >
                                {pkg.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 bg-[var(--accent-espresso)] text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg">
                                        MOST POPULAR
                                    </div>
                                )}
                                {pkg.discount && (
                                    <div className="absolute -top-3 -right-3 z-10 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg border-2 border-white">
                                        {pkg.discount}
                                    </div>
                                )}
                                <CreamCard
                                    className={`h-full cursor-pointer transition-all ${selectedPackage === pkg.id
                                        ? 'ring-4 ring-[var(--accent-espresso)] -translate-y-2'
                                        : 'hover:-translate-y-1'
                                        } ${pkg.popular ? 'border-4' : ''}`}
                                    onClick={() => setSelectedPackage(pkg.id)}
                                >
                                    <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${pkg.color} border-2 ${pkg.borderColor} flex items-center justify-center mb-4 shadow-[2px_2px_0px_var(--accent-espresso)]`}>
                                        <pkg.icon className="text-[var(--accent-espresso)]" size={32} />
                                    </div>
                                    <h3 className="text-2xl font-black text-[var(--accent-espresso)] mb-2">{pkg.name}</h3>
                                    <div className="text-4xl font-black text-[var(--accent-espresso)] mb-1">
                                        {pkg.tokens}
                                        <span className="text-lg font-bold ml-1">tokens</span>
                                    </div>
                                    <div className="text-2xl font-bold text-[var(--accent-peach)] mb-2">
                                        ₱{pkg.pricePHP}
                                    </div>
                                    <div className="text-xs text-[var(--accent-espresso)]/60 font-bold mb-1">
                                        ₱{pkg.pricePerToken.toFixed(2)} per token
                                    </div>
                                    <div className="text-sm text-[var(--accent-espresso)]/60 font-medium">
                                        {pkg.description}
                                    </div>
                                </CreamCard>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Payment Instructions */}
                {selectedPackage && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-12"
                    >
                        <CreamCard className="max-w-3xl mx-auto bg-white">
                            <h2 className="text-3xl font-black text-[var(--accent-espresso)] mb-6 text-center">
                                Payment Instructions
                            </h2>

                            <div className="flex flex-col items-center mb-8">
                                <h3 className="text-lg font-bold text-[var(--accent-espresso)] mb-3">
                                    Where are you paying from?
                                </h3>
                                <div className="flex bg-[var(--bg-cream)] p-1 rounded-xl border-2 border-[var(--accent-espresso)]">
                                    <button
                                        onClick={() => setIsInternational(false)}
                                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${!isInternational
                                            ? 'bg-[var(--accent-espresso)] text-white shadow-md'
                                            : 'text-[var(--accent-espresso)]/60 hover:text-[var(--accent-espresso)]'
                                            }`}
                                    >
                                        Philippines 🇵🇭
                                    </button>
                                    <button
                                        onClick={() => setIsInternational(true)}
                                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${isInternational
                                            ? 'bg-[var(--accent-espresso)] text-white shadow-md'
                                            : 'text-[var(--accent-espresso)]/60 hover:text-[var(--accent-espresso)]'
                                            }`}
                                    >
                                        International 🌏
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Selected Package Info */}
                                <div className="bg-[var(--bg-cream)] rounded-xl p-6 border-2 border-[var(--accent-espresso)]">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="text-sm font-bold text-[var(--accent-espresso)]/60 mb-1">Selected Package</div>
                                            <div className="text-2xl font-black text-[var(--accent-espresso)]">
                                                {packages.find(p => p.id === selectedPackage)?.name}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-[var(--accent-espresso)]/60 mb-1">Total Amount</div>
                                            <div className="text-3xl font-black text-[var(--accent-peach)]">
                                                {isInternational ? (
                                                    <span>${packages.find(p => p.id === selectedPackage)?.priceUSD}</span>
                                                ) : (
                                                    <span>₱{packages.find(p => p.id === selectedPackage)?.pricePHP}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Philippines Payment Flow */}
                                {!isInternational && (
                                    <div className="space-y-4">
                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-espresso)] text-white flex items-center justify-center font-bold">
                                                1
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-[var(--accent-espresso)] mb-2">
                                                    Scan the QR Code
                                                </h3>
                                                <p className="text-[var(--accent-espresso)]/70 mb-4">
                                                    Use your InstaPay app to scan the QR code below and send the exact amount.
                                                </p>
                                                <div className="bg-white rounded-xl p-6 border-2 border-[var(--accent-espresso)] inline-block">
                                                    <Image
                                                        src="/instapay-qr.png"
                                                        alt="InstaPay QR Code"
                                                        width={300}
                                                        height={300}
                                                        className="rounded-lg"
                                                    />
                                                    <div className="text-center mt-4 space-y-1">
                                                        <div className="font-bold text-[var(--accent-espresso)]">Scan to Pay via InstaPay/GCash</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-espresso)] text-white flex items-center justify-center font-bold">
                                                2
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-[var(--accent-espresso)] mb-2">
                                                    Send Payment Proof
                                                </h3>
                                                <p className="text-[var(--accent-espresso)]/70 mb-4">
                                                    After payment, message us on Facebook with your:
                                                </p>
                                                <ul className="space-y-2 mb-4">
                                                    <li className="flex items-start gap-2">
                                                        <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                                                        <span className="text-[var(--accent-espresso)]">Screenshot of payment confirmation</span>
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                                                        <span className="text-[var(--accent-espresso)]">Your CreamDesk account email</span>
                                                    </li>
                                                    <li className="flex items-start gap-2">
                                                        <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                                                        <span className="text-[var(--accent-espresso)]">Package name you purchased</span>
                                                    </li>
                                                </ul>
                                                <a
                                                    href="https://www.facebook.com/profile.php?id=61588058491528"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <CreamButton className="flex items-center gap-2">
                                                        <Facebook size={20} />
                                                        Message on Facebook
                                                    </CreamButton>
                                                </a>
                                                <p className="text-xs text-[var(--accent-espresso)]/60 mt-2 italic">
                                                    Follow our page for exclusive discounts!
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-espresso)] text-white flex items-center justify-center font-bold">
                                                3
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg text-[var(--accent-espresso)] mb-2">
                                                    Receive Your Tokens
                                                </h3>
                                                <p className="text-[var(--accent-espresso)]/70">
                                                    We'll verify your payment and add tokens to your account within 24 hours (usually much faster!).
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* International Payment Flow */}
                                {isInternational && (
                                    <div className="space-y-8 py-4">
                                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center">
                                            <div className="flex justify-center mb-4">
                                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-2 border-blue-100 shadow-sm">
                                                    <Facebook size={32} className="text-blue-600" />
                                                </div>
                                            </div>
                                            <h3 className="font-black text-xl text-[var(--accent-espresso)] mb-2">
                                                International Payment
                                            </h3>
                                            <p className="text-[var(--accent-espresso)]/80 mb-6 max-w-md mx-auto">
                                                For users outside the Philippines, we accept <strong>Wise</strong> or <strong>PayPal</strong>.
                                                Please message us directly on Facebook to request the payment details.
                                            </p>

                                            <div className="flex flex-col items-center gap-3">
                                                <a
                                                    href="https://www.facebook.com/profile.php?id=61588058491528"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <CreamButton className="flex items-center gap-2 bg-[#1877F2] text-white border-blue-700 hover:bg-blue-600">
                                                        <Facebook size={20} />
                                                        Chat via Facebook
                                                    </CreamButton>
                                                </a>
                                                <p className="text-xs text-[var(--accent-espresso)]/60 mt-2">
                                                    We typically reply within a few hours!
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 items-start bg-[var(--bg-cream)] p-4 rounded-xl border border-[var(--accent-espresso)]/10">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--accent-peach)] text-[var(--accent-espresso)] flex items-center justify-center font-bold">
                                                i
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-[var(--accent-espresso)]">Why do I need to message?</h4>
                                                <p className="text-sm text-[var(--accent-espresso)]/70 mt-1">
                                                    International transaction fees vary. By chatting with us, we can ensure you get the best rate and confirm the exact amount in your currency (USD, EUR, etc.) before you pay.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Important Notes */}
                                <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4">
                                    <h4 className="font-bold text-[var(--accent-espresso)] mb-2">⚠️ Important Notes</h4>
                                    <ul className="text-sm text-[var(--accent-espresso)]/80 space-y-1">
                                        <li>• Transfer fees may apply depending on your provider</li>
                                        <li>• Make sure to send the exact amount discussed</li>
                                        <li>• Tokens are non-refundable once added to your account</li>
                                        <li>• Processing time: Usually within 1-24 hours</li>
                                    </ul>
                                </div>
                            </div>
                        </CreamCard>
                    </motion.div>
                )}

                {/* Feature Comparison */}
                <div className="mb-12">
                    <h2 className="text-3xl font-black text-[var(--accent-espresso)] mb-6 text-center">
                        Why Go Monthly?
                    </h2>
                    <div className="max-w-4xl mx-auto overflow-hidden rounded-xl border-2 border-[var(--accent-espresso)] shadow-[4px_4px_0px_var(--accent-espresso)] bg-white">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-[var(--accent-espresso)] text-white">
                                    <th className="p-4 font-bold text-lg">Feature</th>
                                    <th className="p-4 font-bold text-lg w-1/3 bg-white/10">Free / Top-up</th>
                                    <th className="p-4 font-black text-lg w-1/3 bg-yellow-400 text-[var(--accent-espresso)]">Monthly Subscriber</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--accent-espresso)]/20">
                                <tr className="hover:bg-gray-50">
                                    <td className="p-4 font-medium text-[var(--accent-espresso)]">Full App Access (Docs, Drive, Study)</td>
                                    <td className="p-4"><CheckCircle2 className="text-green-500 inline mr-2" size={20} /> Yes</td>
                                    <td className="p-4 bg-yellow-50"><CheckCircle2 className="text-green-600 inline mr-2" size={20} /> Yes</td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                    <td className="p-4 font-medium text-[var(--accent-espresso)]">Token Price</td>
                                    <td className="p-4 text-[var(--accent-espresso)]/70">Standard (₱0.50/token)</td>
                                    <td className="p-4 bg-yellow-50 font-bold text-green-600">Up to 34% OFF (₱0.33/token)</td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                    <td className="p-4 font-medium text-[var(--accent-espresso)]">AI Study Modes</td>
                                    <td className="p-4 text-[var(--accent-espresso)]/70">Standard Generation</td>
                                    <td className="p-4 bg-yellow-50 font-bold text-[var(--accent-espresso)]">Priority Generation</td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                    <td className="p-4 font-medium text-[var(--accent-espresso)]">Advanced Quiz Types <span className="text-xs opacity-50 block font-normal">(Identification, Enumeration)</span></td>
                                    <td className="p-4 text-[var(--accent-espresso)]/70">Locked (Coming Soon)</td>
                                    <td className="p-4 bg-yellow-50"><CheckCircle2 className="text-green-600 inline mr-2" size={20} /> Full Access</td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                    <td className="p-4 font-medium text-[var(--accent-espresso)]">Cloud Storage</td>
                                    <td className="p-4 text-[var(--accent-espresso)]/70">100 MB Limit</td>
                                    <td className="p-4 bg-yellow-50 font-bold text-[var(--accent-espresso)]">1 GB Storage</td>
                                </tr>
                                <tr className="hover:bg-gray-50">
                                    <td className="p-4 font-medium text-[var(--accent-espresso)]">Token Rollover Protection</td>
                                    <td className="p-4 text-red-400"><span className="inline-block w-5 text-center font-bold">×</span> No</td>
                                    <td className="p-4 bg-yellow-50"><CheckCircle2 className="text-green-600 inline mr-2" size={20} /> Resets to 100 max</td>
                                </tr>
                                <tr className="bg-gray-50">
                                    <td className="p-4 font-bold text-[var(--accent-espresso)]">Customer Support</td>
                                    <td className="p-4 text-[var(--accent-espresso)]/70">Standard</td>
                                    <td className="p-4 bg-yellow-50 font-bold text-[var(--accent-espresso)]">Priority Support</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Info Section */}
                {!selectedPackage && (
                    <div className="max-w-3xl mx-auto">
                        <CreamCard className="bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-cream)]">
                            <h3 className="text-2xl font-black text-[var(--accent-espresso)] mb-4">How it works</h3>
                            <div className="space-y-3 text-[var(--accent-espresso)]/80">
                                <p className="flex items-start gap-2">
                                    <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>Select a token package above</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>Pay via InstaPay using the QR code</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>Send payment proof to our Facebook page</span>
                                </p>
                                <p className="flex items-start gap-2">
                                    <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                                    <span>Receive tokens in your account within 24 hours</span>
                                </p>
                            </div>
                        </CreamCard>
                    </div>
                )}
            </div>
        </div>
    )
}
