'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
    const [mounted, setMounted] = useState(false);
    const { theme, setTheme } = useTheme();

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        return (
            <button
                className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-background-secondary transition-smooth"
                aria-label="Toggle theme"
            >
                <div className="h-4 w-4" />
            </button>
        );
    }

    return (
        <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="h-8 w-8 rounded-md flex items-center justify-center hover:bg-background-secondary transition-smooth group"
            aria-label="Toggle theme"
        >
            {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-foreground-muted group-hover:text-foreground transition-smooth" />
            ) : (
                <Moon className="h-4 w-4 text-foreground-muted group-hover:text-foreground transition-smooth" />
            )}
        </button>
    );
}
