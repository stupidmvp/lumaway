import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export interface SearchInputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    onClear?: () => void
    wrapperClassName?: string
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
    ({ className, wrapperClassName, value, onClear, onChange, ...props }, ref) => {
        return (
            <div className={cn("relative", wrapperClassName)}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                    type="text"
                    className={cn(
                        "pl-10 pr-10 h-10 bg-background border-input transition-none text-sm focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none",
                        className
                    )}
                    ref={ref}
                    value={value}
                    onChange={onChange}
                    {...props}
                />
                {value && value.toString().length > 0 && onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full hover:bg-muted"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Clear search</span>
                    </button>
                )}
            </div>
        )
    }
)
SearchInput.displayName = "SearchInput"

export { SearchInput }
