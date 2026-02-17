'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PasswordService } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function ForgotPasswordPage() {
    const t = useTranslations('ForgotPassword');

    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isEmailSent, setIsEmailSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await PasswordService.forgotPassword({ email });
            setIsEmailSent(true);
        } catch (err: any) {
            console.error(err);
            setError(t('requestFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-black bg-[radial-gradient(circle_at_50%_30%,#1E1E2E_0%,#12121A_60%,#0B0B0F_100%)]">
            <div className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-8">
                        <div className="w-24 h-24 relative flex items-center justify-center">
                            <Image
                                src="/luma.png"
                                alt="LumaWay Logo"
                                width={96}
                                height={96}
                                className="object-contain drop-shadow-[0_0_25px_rgba(167,216,255,0.6)]"
                                priority
                            />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">{t('title')}</h1>
                    {!isEmailSent && (
                        <p className="text-slate-400 text-sm max-w-xs mx-auto">{t('subtitle')}</p>
                    )}
                </div>

                {isEmailSent ? (
                    <div className="space-y-6">
                        <div className="bg-accent-blue/10 border border-accent-blue/20 rounded-xl p-5 text-center space-y-3">
                            <div className="flex justify-center">
                                <div className="h-12 w-12 rounded-full bg-accent-blue/20 flex items-center justify-center">
                                    <Mail className="h-6 w-6 text-accent-blue" />
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold text-white">{t('successTitle')}</h3>
                            <p className="text-sm text-slate-300">
                                {t('successDescription')}{' '}
                                <span className="font-medium text-white">{email}</span>
                            </p>
                            <p className="text-xs text-slate-500">{t('checkSpam')}</p>
                        </div>
                        <Button
                            variant="outline"
                            className="w-full border-white/10 text-slate-300 hover:bg-white/5 hover:text-white"
                            onClick={() => {
                                setIsEmailSent(false);
                                setEmail('');
                            }}
                        >
                            {t('resendInstructions')}
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm text-center">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
                                {t('emailLabel')}
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-lumen-blue/50 focus:border-lumen-blue/50 outline-none transition-all hover:bg-white/10"
                                placeholder={t('emailPlaceholder')}
                                required
                            />
                        </div>

                        <div className="flex justify-center mt-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                variant="gradient"
                                size="lg"
                                className="w-full h-12 rounded-full text-base font-semibold gap-2 shadow-lg hover:scale-105 duration-200"
                            >
                                {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                                {loading ? t('sending') : t('sendInstructions')}
                            </Button>
                        </div>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <Link
                        href="/login"
                        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {t('backToLogin')}
                    </Link>
                </div>
            </div>
        </div>
    );
}


