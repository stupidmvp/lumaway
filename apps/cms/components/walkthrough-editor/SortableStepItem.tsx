// Optimized SortableStepItem with Linear Design
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Step } from '@luma/infra';
import { GripVertical, Route, MoreVertical, Copy, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function SortableStepItem({
    step,
    index,
    isActive,
    totalSteps,
    onClick,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    onDelete,
}: {
    step: Step;
    index: number;
    isActive: boolean;
    totalSteps: number;
    onClick: () => void;
    onDuplicate: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onDelete: () => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        setActivatorNodeRef
    } = useSortable({ id: step.id });
    const t = useTranslations('Editor');

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onClick}
            className={`
                group p-2 rounded-md mb-1 flex items-center gap-2.5 cursor-pointer transition-all duration-200
                ${isActive
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'bg-transparent hover:bg-background-secondary text-foreground-muted hover:text-foreground'
                }
                ${isDragging ? 'opacity-50 shadow-sm ring-1 ring-border z-10 bg-background' : 'opacity-100'}
            `}
        >
            {/* Left icon: Route by default, drag handle on hover */}
            <div className="relative flex-shrink-0 w-4 h-4">
                <Route className={`h-4 w-4 absolute inset-0 transition-opacity ${isActive ? 'opacity-0' : 'group-hover:opacity-0'} ${isActive ? 'text-accent-blue' : 'text-foreground-subtle'}`} />
                <div
                    ref={setActivatorNodeRef}
                    {...attributes}
                    {...listeners}
                    className={`absolute inset-0 transition-opacity cursor-grab active:cursor-grabbing text-foreground-subtle hover:text-foreground-muted ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                >
                    <GripVertical className="h-4 w-4" />
                </div>
            </div>

            <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium truncate ${isActive ? 'text-foreground' : 'text-foreground-muted'}`}>
                    {step.title || <span className="italic opacity-50">{t('noTargetSelector')}</span>}
                </div>
                <div className="text-xs text-foreground-subtle truncate">
                    {step.target || t('noTargetSelector')}
                </div>
            </div>

            {/* Actions Dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-background-tertiary text-foreground-subtle hover:text-foreground transition-all"
                    >
                        <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                        className="gap-2 text-xs"
                    >
                        <Copy className="h-3.5 w-3.5 opacity-60" />
                        {t('duplicateStep')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
                        disabled={index === 0}
                        className="gap-2 text-xs"
                    >
                        <ArrowUp className="h-3.5 w-3.5 opacity-60" />
                        {t('moveUp')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
                        disabled={index === totalSteps - 1}
                        className="gap-2 text-xs"
                    >
                        <ArrowDown className="h-3.5 w-3.5 opacity-60" />
                        {t('moveDown')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="gap-2 text-xs text-destructive focus:text-destructive"
                    >
                        <Trash2 className="h-3.5 w-3.5 opacity-60" />
                        {t('deleteStep')}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
