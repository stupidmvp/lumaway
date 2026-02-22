
import React from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, X } from 'lucide-react';

interface AiContextFormProps {
    purpose: string;
    onChange: (value: string) => void;
    className?: string;
}

export const AiContextForm: React.FC<AiContextFormProps> = ({
    purpose,
    onChange,
    className
}) => {
    const t = useTranslations('Editor');
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [showInfo, setShowInfo] = React.useState(true);

    React.useEffect(() => {
        // Auto-focus when component mounts (drawer opens)
        if (textareaRef.current) {
            // Small timeout to ensure drawer animation is done or DOM is ready
            setTimeout(() => {
                textareaRef.current?.focus();
            }, 100);
        }
    }, []);

    return (
        <div className={`space-y-4 ${className}`}>
            {showInfo && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-start gap-3 relative group">
                    <Sparkles className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-1">
                        <h4 className="text-sm font-medium text-primary">
                            {t('aiContext')}
                        </h4>
                        <p className="text-xs text-foreground-muted pr-4">
                            {t('aiContextPlaceholder')}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowInfo(false)}
                        className="absolute top-2 right-2 text-foreground-muted/50 hover:text-foreground-muted p-1 rounded-full hover:bg-black/5 transition-colors"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </div>
            )}

            <div className="space-y-2">
                <label className="text-xs font-medium text-foreground uppercase tracking-wider">
                    {t('aiContext')}
                </label>
                <textarea
                    ref={textareaRef}
                    className="w-full min-h-[200px] p-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                    value={purpose || ''}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={t('aiContextPlaceholder')}
                />
                <p className="text-xs text-foreground-muted">
                    Describe el objetivo de este paso para que el asistente pueda entenderlo y guiar al usuario correctamente.
                </p>
            </div>
        </div>
    );
};
