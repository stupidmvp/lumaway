"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarDays } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface DatePickerProps {
  /** ISO date string (yyyy-MM-dd) or empty string */
  value?: string
  /** Callback with ISO date string (yyyy-MM-dd) or empty string when cleared */
  onChange?: (value: string) => void
  /** Placeholder text when no date is selected */
  placeholder?: string
  /** Minimum selectable date as ISO string */
  min?: string
  /** Maximum selectable date as ISO string */
  max?: string
  /** Additional class names for the trigger button */
  className?: string
  /** Whether the picker is disabled */
  disabled?: boolean
  /** Display format for the date (default: "PPP") */
  displayFormat?: string
}

function parseISODate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const date = parse(value, "yyyy-MM-dd", new Date())
  return isValid(date) ? date : undefined
}

function toISOString(date: Date | undefined): string {
  if (!date) return ""
  return format(date, "yyyy-MM-dd")
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  min,
  max,
  className,
  disabled,
  displayFormat = "PPP",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const selectedDate = parseISODate(value)
  const fromDate = parseISODate(min)
  const toDate = parseISODate(max)

  const handleSelect = (date: Date | undefined) => {
    onChange?.(toISOString(date))
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-9",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          {selectedDate ? format(selectedDate, displayFormat) : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(date) => {
            if (fromDate && date < fromDate) return true
            if (toDate && date > toDate) return true
            return false
          }}
          defaultMonth={selectedDate || fromDate}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

