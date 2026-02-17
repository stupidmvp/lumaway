
import Link from 'next/link';
import { GitPullRequest, ArrowRight, Tag, Layers } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getActorColor } from '@/components/project-detail/ActorsPanel';
import { cn } from '@/lib/utils';

interface WalkthroughCardProps {
    walkthrough: {
        id: string;
        title: string;
        projectId: string;
        parentId?: string | null;
        isPublished: boolean;
        steps: any[];
        tags?: string[];
        actors?: Array<{
            id: string;
            name: string;
            slug: string;
            description?: string;
            color?: string;
        }>;
        project?: {
            name: string;
        };
    };
    onTagClick?: (tag: string) => void;
    onActorClick?: (actorId: string) => void;
    /** Explicitly marks this card as a child (nested) walkthrough */
    isChild?: boolean;
    /** Number of children grouped under this parent */
    childCount?: number;
}

export function WalkthroughCard({ walkthrough, onTagClick, onActorClick, isChild = false, childCount = 0 }: WalkthroughCardProps) {
    const tc = useTranslations('Common');
    const t = useTranslations('Walkthroughs');

    const tags = walkthrough.tags ?? [];
    const actors = walkthrough.actors ?? [];

    return (
        <Link
            href={`/walkthroughs/${walkthrough.id}`}
            className="block group"
        >
            <div className={cn(
                "border bg-background hover:bg-background-secondary transition-all hover:border-accent-blue/30 hover:shadow-lg hover:shadow-accent-blue/5",
                isChild
                    ? "px-3 py-2.5 rounded-md border-border/40 hover:border-accent-blue/20 hover:shadow-md hover:shadow-accent-blue/3"
                    : "p-4 rounded-lg border-border",
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                            "shrink-0 rounded-md flex items-center justify-center transition-all duration-300 border",
                            isChild
                                ? "h-8 w-8 bg-foreground-muted/5 text-foreground-muted border-border/40 group-hover:bg-accent-blue group-hover:text-white group-hover:border-accent-blue"
                                : "h-10 w-10 bg-accent-blue/5 text-accent-blue border-accent-blue/10 group-hover:bg-accent-blue group-hover:text-white"
                        )}>
                            <GitPullRequest className={isChild ? "h-4 w-4" : "h-5 w-5"} />
                        </div>
                        <div className="min-w-0">
                            <h3 className={cn(
                                "font-medium text-foreground group-hover:text-accent-blue transition-colors capitalize truncate",
                                isChild ? "text-sm" : "text-base",
                            )}>
                                {walkthrough.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {!isChild && (
                                    <>
                                        <p className="text-xs text-foreground-muted">
                                            {walkthrough.project?.name || t('project', { id: walkthrough.projectId })}
                                        </p>
                                        <span className="text-[10px] text-foreground-subtle">·</span>
                                    </>
                                )}
                                <p className="text-xs text-foreground-muted">
                                    {t('stepsCount', { count: walkthrough.steps.length })}
                                </p>
                                {!isChild && childCount > 0 && (
                                    <>
                                        <span className="text-[10px] text-foreground-subtle">·</span>
                                        <span className="inline-flex items-center gap-1 text-xs text-foreground-muted">
                                            <Layers className="h-3 w-3" />
                                            {t('childCount', { count: childCount })}
                                        </span>
                                    </>
                                )}
                                {tags.length > 0 && (
                                    <>
                                        <span className="text-[10px] text-foreground-subtle">·</span>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {tags.map((tag) => (
                                                <span
                                                    key={tag}
                                                    onClick={(e) => {
                                                        if (onTagClick) {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            onTagClick(tag);
                                                        }
                                                    }}
                                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-medium bg-accent-blue/8 text-accent-blue border border-accent-blue/15 ${onTagClick ? 'hover:bg-accent-blue/15 cursor-pointer' : ''}`}
                                                >
                                                    <Tag className="h-2.5 w-2.5" />
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                                {actors.length > 0 && (
                                    <>
                                        <span className="text-[10px] text-foreground-subtle">·</span>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {actors.map((actor) => {
                                                const colorDef = getActorColor(actor.color);
                                                return (
                                                    <span
                                                        key={actor.id}
                                                        onClick={(e) => {
                                                            if (onActorClick) {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                onActorClick(actor.id);
                                                            }
                                                        }}
                                                        className={cn(
                                                            'inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[10px] font-medium border-0',
                                                            colorDef.bg,
                                                            colorDef.text,
                                                            onActorClick && 'hover:opacity-80 cursor-pointer',
                                                        )}
                                                    >
                                                        <span className={cn('h-1.5 w-1.5 rounded-full', colorDef.dot)} />
                                                        {actor.name}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-background-secondary/50 border border-border/50",
                            isChild && "px-2 py-0.5",
                        )}>
                            <span className={`h-1.5 w-1.5 rounded-full ${walkthrough.isPublished ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                                }`} />
                            <span className={cn(
                                "font-bold tracking-wider uppercase text-foreground-muted",
                                isChild ? "text-[9px]" : "text-[10px]",
                            )}>
                                {walkthrough.isPublished ? tc('published') : tc('draft')}
                            </span>
                        </div>
                        <ArrowRight className={cn(
                            "text-foreground-subtle group-hover:translate-x-1 transition-transform group-hover:text-accent-blue",
                            isChild ? "h-3.5 w-3.5" : "h-4 w-4",
                        )} />
                    </div>
                </div>
            </div>
        </Link>
    );
}
