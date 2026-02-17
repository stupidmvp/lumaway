'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { AuthService } from '@luma/infra';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get('redirect');
    const t = useTranslations('Login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await AuthService.login({
                email,
                password,
                strategy: 'local',
            });
            router.push(redirectTo || '/projects');
        } catch (err: any) {
            console.error('Login error:', err.response?.status, err.response?.data);
            setError(err.response?.data?.error || err.response?.data?.message || t('loginFailed'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-brand-black bg-[radial-gradient(circle_at_50%_30%,#1E1E2E_0%,#12121A_60%,#0B0B0F_100%)]">
            <div className="bg-white/5 backdrop-blur-lg p-8 rounded-2xl shadow-2xl w-full max-w-md border border-white/10">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-8">
                        <div className="w-32 h-32 relative flex items-center justify-center">
                            <Image
                                src="/luma.png"
                                alt="LumaWay Logo"
                                width={128}
                                height={128}
                                className="object-contain drop-shadow-[0_0_25px_rgba(167,216,255,0.6)] hover:scale-105 transition-transform duration-500"
                                priority
                            />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{t('title')}</h1>
                    <p className="text-slate-400 text-sm">{t('subtitle')}</p>
                </div>

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
                    </div>

                    <div className="flex justify-center mt-4">
                        <Button
                            type="submit"
                            disabled={loading}
                            variant="gradient"
                            size="lg"
                            className="w-[calc(100%-2rem)] h-14 rounded-full text-xl font-semibold gap-2 shadow-lg hover:scale-105 duration-200"
                        >
                            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                            {loading ? t('signingIn') : t('signIn')}
                            {!loading && <ArrowRight className="h-5 w-5" />}
                        </Button>
                    </div>
                </form>

                <div className="mt-8 text-center text-sm text-slate-500 space-y-3">
                    <div className="flex justify-center gap-4">
                        <Link href="/forgot-password" className="hover:text-lumen-blue transition-colors">{t('forgotPassword')}</Link>
                        <span className="text-slate-700">|</span>
                        <a href="#" className="text-lumen-lavender hover:text-white transition-colors">{t('contactSupport')}</a>
                    </div>
                    <div>
                        <span className="text-slate-500">{t('noAccount')} </span>
                        <Link href={redirectTo ? `/register?redirect=${encodeURIComponent(redirectTo)}` : '/register'} className="text-lumen-lavender hover:text-white transition-colors">
                            {t('createAccount')}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
