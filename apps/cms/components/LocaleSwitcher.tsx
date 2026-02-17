'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

const LOCALES = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
] as const;

export function LocaleSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const t = useTranslations('LocaleSwitcher');

    const handleLocaleChange = (newLocale: string) => {
        // Replace the current locale segment in the pathname
        const segments = pathname.split('/');
        // The locale is the first real segment (e.g. /en/dashboard → ['', 'en', 'dashboard'])
        if (segments[1] && LOCALES.some((l) => l.code === segments[1])) {
            segments[1] = newLocale;
        }
        router.push(segments.join('/'));
        setOpen(false);
    };

    const currentLocale = LOCALES.find((l) => l.code === locale);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    className="h-8 rounded-md flex items-center gap-1.5 px-2 hover:bg-background-secondary transition-smooth group cursor-pointer"
                    aria-label={t('switchLanguage')}
                >
                    <Languages className="h-4 w-4 text-foreground-muted group-hover:text-foreground transition-smooth" />
                    <span className="text-xs font-medium text-foreground-muted group-hover:text-foreground uppercase tracking-wide">
                        {locale}
                    </span>
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="end"
                sideOffset={6}
                className="w-40 p-1"
            >
                {LOCALES.map((loc) => (
                    <button
                        key={loc.code}
                        onClick={() => handleLocaleChange(loc.code)}
                        className={`flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors cursor-pointer ${
                            loc.code === locale
                                ? 'bg-accent text-accent-foreground font-medium'
                                : 'hover:bg-accent hover:text-accent-foreground'
                        }`}
                    >
                        <span className="uppercase text-xs font-semibold w-5 text-center opacity-60">
                            {loc.code}
                        </span>
                        {loc.label}
                    </button>
                ))}
            </PopoverContent>
        </Popover>
    );
}

