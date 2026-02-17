
import * as React from "react"
import { Check, Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SearchInput } from "@/components/ui/search-input"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { useTranslations } from "next-intl"

interface FilterOption {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
}

interface FilterButtonProps {
    title?: string
    options: FilterOption[]
    value?: string
    onChange: (value: string) => void
    variant?: "outline" | "ghost" | "plain" | "link" | "default" | "secondary" | "destructive"
    className?: string
}

export function FilterButton({
    title,
    options,
    value,
    onChange,
    variant = "outline",
    className
}: FilterButtonProps) {
    const [open, setOpen] = React.useState(false)
    const [search, setSearch] = React.useState("")
    const selectedOption = options.find(opt => opt.value === value) || null
    const tc = useTranslations('Common')

    const displayTitle = title || tc('filter')

    const filteredOptions = options.filter(opt =>
        opt.label.toLowerCase().includes(search.toLowerCase())
    )

    const isFiltered = value && value !== 'all'

    return (
        <div className="flex items-center gap-1">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant={variant as any}
                        role="combobox"
                        aria-expanded={open}
                        className={cn(
                            "h-10 w-full min-w-[140px] justify-between hover:bg-accent/50 px-3",
                            isFiltered && "bg-accent/20",
                            className
                        )}
                    >
                        <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-foreground-muted" />
                            <span className="text-foreground-subtle">{displayTitle}</span>
                            {selectedOption && (
                                <>
                                    <div className="h-4 w-[1px] bg-border" />
                                    <Badge
                                        variant="secondary"
                                        className="rounded-sm px-1.5 font-medium bg-background-tertiary text-foreground"
                                    >
                                        {selectedOption.label}
                                    </Badge>
                                </>
                            )}
                        </div>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-2" align="end">
                    <SearchInput
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onClear={() => setSearch("")}
                        placeholder={displayTitle}
                        className="h-9"
                        wrapperClassName="mb-2"
                    />
                    <Command shouldFilter={false}>
                        <CommandList>
                            <CommandEmpty>{tc('noResults')}</CommandEmpty>
                            <CommandGroup>
                                {/* Always show 'All' if search is empty or matches 'all' */}
                                {(!search || "all".includes(search.toLowerCase())) && !options.some(opt => opt.value === 'all') && (
                                    <CommandItem
                                        onSelect={() => {
                                            onChange("all")
                                            setOpen(false)
                                        }}
                                        className="cursor-pointer"
                                    >
                                        <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary/50",
                                                (!value || value === 'all')
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "opacity-50 [&_svg]:invisible"
                                            )}
                                        >
                                            <Check className={cn("h-3 w-3")} />
                                        </div>
                                        <span>{tc('all')}</span>
                                    </CommandItem>
                                )}
                                {filteredOptions.map((option) => {
                                    const isSelected = value === option.value
                                    return (
                                        <CommandItem
                                            key={option.value}
                                            onSelect={() => {
                                                onChange(option.value)
                                                setOpen(false)
                                            }}
                                            className="cursor-pointer"
                                        >
                                            <div
                                                className={cn(
                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary/50",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "opacity-50 [&_svg]:invisible"
                                                )}
                                            >
                                                <Check className={cn("h-3 w-3")} />
                                            </div>
                                            {option.icon && (
                                                <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span>{option.label}</span>
                                        </CommandItem>
                                    )
                                })}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            {isFiltered && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => onChange("all")}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">{tc('clearFilter')}</span>
                </Button>
            )}
        </div>
    )
}
