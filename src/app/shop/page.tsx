"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CreamButton, CreamCard } from '@/components/ui/CreamComponents'
import { Coins, Zap, Star, Crown, Facebook, CheckCircle2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function ShopPage() {
    const [selectedPackage, setSelectedPackage] = useState<string | null>(null)

    const packages = [
        {
            id: 'starter',
            name: 'Starter Pack',
            tokens: 100,
            priceUSD: 3.33,
            pricePHP: 200,
            pricePerToken: 2.00,
            discount: null,
            icon: Coins,
            color: 'from-blue-50 to-cyan-50',
            borderColor: 'border-blue-500',
            popular: false
        },
        {
            id: 'pro',
            name: 'Pro Pack',
            tokens: 250,
            priceUSD: 7.50,
            pricePHP: 450,
            pricePerToken: 1.80,
            discount: '10% OFF',
            icon: Zap,
            color: 'from-purple-50 to-pink-50',
            borderColor: 'border-purple-500',
            popular: true
        },
        {
            id: 'premium',
            name: 'Premium Pack',
            tokens: 500,
            priceUSD: 14.17,
            pricePHP: 850,
            pricePerToken: 1.70,
            discount: '15% OFF',
            icon: Star,
            color: 'from-orange-50 to-yellow-50',
            borderColor: 'border-orange-500',
            popular: false
        },
        {
            id: 'ultimate',
            name: 'Ultimate Pack',
            tokens: 1000,
            priceUSD: 25.00,
            pricePHP: 1500,
            pricePerToken: 1.50,
            discount: '25% OFF',
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

                {/* Packages Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {packages.map((pkg, i) => (
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
                                    ~${pkg.priceUSD} USD
                                </div>
                            </CreamCard>
                        </motion.div>
                    ))}
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
                                                ₱{packages.find(p => p.id === selectedPackage)?.pricePHP}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Steps */}
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
                                                    <div className="font-bold text-[var(--accent-espresso)]">RA****T L.</div>
                                                    <div className="text-sm text-[var(--accent-espresso)]/60">Mobile: 0962 230 ••••</div>
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

                                {/* Important Notes */}
                                <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-4">
                                    <h4 className="font-bold text-[var(--accent-espresso)] mb-2">⚠️ Important Notes</h4>
                                    <ul className="text-sm text-[var(--accent-espresso)]/80 space-y-1">
                                        <li>• Transfer fees may apply depending on your bank</li>
                                        <li>• Make sure to send the exact amount</li>
                                        <li>• Tokens are non-refundable once added to your account</li>
                                        <li>• Processing time: Usually within 1-24 hours</li>
                                    </ul>
                                </div>
                            </div>
                        </CreamCard>
                    </motion.div>
                )}

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
