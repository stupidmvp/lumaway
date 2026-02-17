'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { AuthService } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Eye, EyeOff, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function RegisterPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect');
    const t = useTranslations('Register');

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const passwordValidation = useMemo(() => {
        return [
            { id: 'min', label: t('minLength'), met: password.length >= 8 },
            { id: 'lower', label: t('lowercase'), met: /[a-z]/.test(password) },
            { id: 'upper', label: t('uppercase'), met: /[A-Z]/.test(password) },
            { id: 'number', label: t('number'), met: /[0-9]/.test(password) },
        ];
    }, [password, t]);

    const isFormValid =
        firstName.trim() &&
        email.trim() &&
        passwordValidation.every((v) => v.met) &&
        password === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) return;

        setLoading(true);
        setError('');

        try {
            await AuthService.register({
                email,
                password,
                firstName,
                lastName: lastName || undefined,
            });
            // New users go to onboarding first, unless they have a redirect (e.g. invitation)
            router.push(redirectTo || '/onboarding');
        } catch (err: any) {
            console.error(err);
            const message =
                err?.response?.data?.error ||
                err?.response?.data?.message ||
                err?.message ||
                t('registerFailed');
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-black bg-[radial-gradient(circle_at_50%_30%,#1E1E2E_0%,#12121A_60%,#0B0B0F_100%)] py-8 px-4">
            <div className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
                <div className="text-center mb-6">
                    <div className="flex justify-center mb-6">
                        <div className="w-24 h-24 relative flex items-center justify-center">
                            <Image
                                src="/luma.png"
                                alt="LumaWay Logo"
                                width={96}
                                height={96}
                                className="object-contain drop-shadow-[0_0_25px_rgba(167,216,255,0.6)] hover:scale-105 transition-transform duration-500"
                                priority
                            />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1.5 tracking-tight">{t('title')}</h1>
                    <p className="text-slate-400 text-sm">{t('subtitle')}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg text-sm text-center">
                            {error}
                        </div>
                    )}

                    {/* Name fields */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
                                {t('firstNameLabel')}
                            </label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-lumen-blue/50 focus:border-lumen-blue/50 outline-none transition-all hover:bg-white/10"
                                placeholder={t('firstNamePlaceholder')}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
                                {t('lastNameLabel')}
                            </label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-lumen-blue/50 focus:border-lumen-blue/50 outline-none transition-all hover:bg-white/10"
                                placeholder={t('lastNamePlaceholder')}
                            />
                        </div>
                    </div>

                    {/* Email */}
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

                    {/* Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
                            {t('passwordLabel')}
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-lumen-blue/50 focus:border-lumen-blue/50 outline-none transition-all hover:bg-white/10"
                                placeholder={t('passwordPlaceholder')}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>

                        {/* Password requirements */}
                        {password.length > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-1">
                                {passwordValidation.map((req) => (
                                    <div key={req.id} className="flex items-center gap-1.5 text-xs">
                                        {req.met ? (
                                            <Check className="h-3 w-3 text-green-400 flex-shrink-0" />
                                        ) : (
                                            <X className="h-3 w-3 text-slate-500 flex-shrink-0" />
                                        )}
                                        <span className={req.met ? 'text-green-400' : 'text-slate-500'}>
                                            {req.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-1.5 ml-1">
                            {t('confirmPasswordLabel')}
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-lumen-blue/50 focus:border-lumen-blue/50 outline-none transition-all hover:bg-white/10"
                                placeholder={t('confirmPasswordPlaceholder')}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                        {confirmPassword && password !== confirmPassword && (
                            <p className="text-xs text-red-400 mt-1.5 ml-1">{t('passwordsMustMatch')}</p>
                        )}
                    </div>

                    <div className="flex justify-center pt-2">
                        <Button
                            type="submit"
                            disabled={loading || !isFormValid}
                            variant="gradient"
                            size="lg"
                            className="w-[calc(100%-2rem)] h-14 rounded-full text-xl font-semibold gap-2 shadow-lg hover:scale-105 duration-200"
                        >
                            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                            {loading ? t('creating') : t('createAccount')}
                            {!loading && <ArrowRight className="h-5 w-5" />}
                        </Button>
                    </div>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                    <span>{t('alreadyHaveAccount')} </span>
                    <Link
                        href={redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : '/login'}
                        className="text-lumen-lavender hover:text-white transition-colors"
                    >
                        {t('signIn')}
                    </Link>
                </div>
            </div>
        </div>
    );
}

