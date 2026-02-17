'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { PasswordService } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { useTranslations } from 'next-intl';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const t = useTranslations('ResetPassword');

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const passwordValid = newPassword.length >= 8;
    const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!token) {
            setError(t('missingToken'));
            return;
        }

        if (!passwordValid) {
            setError(t('passwordMinLength'));
            return;
        }

        if (!passwordsMatch) {
            setError(t('passwordsMustMatch'));
            return;
        }

        setLoading(true);

        try {
            await PasswordService.resetPassword({ token, newPassword });
            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            const message = err.response?.data?.error;
            if (message?.includes('expired') || message?.includes('Invalid')) {
                setError(t('invalidToken'));
            } else {
                setError(t('resetFailed'));
            }
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="space-y-6 text-center">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 space-y-2">
                    <LockKeyhole className="h-8 w-8 text-red-400 mx-auto" />
                    <p className="text-sm text-red-200">{t('missingToken')}</p>
                </div>
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t('backToLogin')}
                </Link>
            </div>
        );
    }

    if (success) {
        return (
            <div className="space-y-6">
                <div className="bg-accent-green/10 border border-accent-green/20 rounded-xl p-5 text-center space-y-3">
                    <div className="flex justify-center">
                        <div className="h-12 w-12 rounded-full bg-accent-green/20 flex items-center justify-center">
                            <CheckCircle2 className="h-6 w-6 text-accent-green" />
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold text-white">{t('resetSuccess')}</h3>
                </div>
                <Button
                    variant="gradient"
                    size="lg"
                    className="w-full h-12 rounded-full text-base font-semibold gap-2"
                    onClick={() => router.push('/login')}
                >
                    {t('goToLogin')}
                    <ArrowRight className="h-5 w-5" />
                </Button>
            </div>
        );
    }

    return (
        <>
            <p className="text-slate-400 text-sm max-w-xs mx-auto text-center mb-6">{t('subtitle')}</p>

            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm text-center">
                        {error}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
                        {t('newPasswordLabel')}
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={`w-full px-4 py-3 pr-12 bg-white/5 border rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-lumen-blue/50 outline-none transition-all hover:bg-white/10 ${
                                newPassword.length > 0
                                    ? passwordValid
                                        ? 'border-accent-green/50'
                                        : 'border-amber-500/50'
                                    : 'border-white/10'
                            }`}
                            placeholder={t('newPasswordPlaceholder')}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
                        {t('confirmPasswordLabel')}
                    </label>
                    <div className="relative">
                        <input
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={`w-full px-4 py-3 pr-12 bg-white/5 border rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-lumen-blue/50 outline-none transition-all hover:bg-white/10 ${
                                confirmPassword.length > 0
                                    ? passwordsMatch
                                        ? 'border-accent-green/50'
                                        : 'border-red-500/50'
                                    : 'border-white/10'
                            }`}
                            placeholder={t('confirmPasswordPlaceholder')}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                            {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                    {confirmPassword.length > 0 && !passwordsMatch && (
                        <p className="text-xs text-red-400 mt-1 ml-1">{t('passwordsMustMatch')}</p>
                    )}
                </div>

                <div className="flex justify-center mt-4">
                    <Button
                        type="submit"
                        disabled={loading || !passwordValid || !passwordsMatch}
                        variant="gradient"
                        size="lg"
                        className="w-full h-12 rounded-full text-base font-semibold gap-2 shadow-lg hover:scale-105 duration-200"
                    >
                        {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                        {loading ? t('resetting') : t('resetPassword')}
                    </Button>
                </div>
            </form>

            <div className="mt-6 text-center">
                <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t('backToLogin')}
                </Link>
            </div>
        </>
    );
}

export default function ResetPasswordPage() {
    const t = useTranslations('ResetPassword');

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-black bg-[radial-gradient(circle_at_50%_30%,#1E1E2E_0%,#12121A_60%,#0B0B0F_100%)]">
            <div className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
                <div className="text-center mb-6">
                    <div className="flex justify-center mb-6">
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
                </div>

                <Suspense fallback={
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                }>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </div>
    );
}


