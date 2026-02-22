
import React from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Sparkles } from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AiContextForm } from './AiContextForm';

interface AiContextDrawerProps {
    purpose: string;
    onUpdatePromise: (value: string) => void;
    trigger?: React.ReactNode;
}

export const AiContextDrawer: React.FC<AiContextDrawerProps> = ({
    purpose,
    onUpdatePromise,
    trigger
}) => {
    const t = useTranslations('Editor');

    return (
        <Sheet>
            <SheetTrigger asChild>
                {trigger || (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-foreground-muted hover:text-primary transition-colors"
                    >
                        <Bot className="h-4 w-4" />
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        {t('aiContext')}
                    </SheetTitle>
                    <SheetDescription>
                        Configura cómo la Inteligencia Artificial interpreta y asiste en este paso.
                    </SheetDescription>
                </SheetHeader>
                <div className="mt-6">
                    <AiContextForm
                        purpose={purpose}
                        onChange={onUpdatePromise}
                    />
                </div>
            </SheetContent>
        </Sheet>
    );
};
