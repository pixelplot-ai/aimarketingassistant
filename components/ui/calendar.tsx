"use client"

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

interface CalendarProps {
  month: Date
  selected?: Date | null
  onSelect?: (date: Date) => void
  onMonthChange?: (month: Date) => void
  modifiers?: {
    hasEvents?: (date: Date) => boolean
    eventCount?: (date: Date) => number
  }
  className?: string
  compact?: boolean
}

function buildMonthDays(month: Date): Date[] {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  return eachDayOfInterval({ start: gridStart, end: gridEnd })
}

export function Calendar({
  month,
  selected,
  onSelect,
  onMonthChange,
  modifiers,
  className,
  compact = false,
}: CalendarProps) {
  const days = buildMonthDays(month)

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => onMonthChange?.(subMonths(month, 1))}
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="text-center">
          <p className="text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Next month"
          onClick={() => onMonthChange?.(addMonths(month, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {compact ? label.slice(0, 1) : label}
          </div>
        ))}

        {days.map((day) => {
          const inMonth = isSameMonth(day, month)
          const selectedDay = selected ? isSameDay(day, selected) : false
          const today = isToday(day)
          const hasEvents = modifiers?.hasEvents?.(day) ?? false
          const eventCount = modifiers?.eventCount?.(day) ?? 0

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect?.(day)}
              className={cn(
                "relative flex flex-col items-center rounded-lg border border-transparent transition-colors",
                compact ? "h-9 gap-0.5 py-1" : "h-11 gap-1 py-1.5",
                inMonth
                  ? "text-foreground hover:bg-muted/60"
                  : "text-muted-foreground/40 hover:bg-muted/30",
                selectedDay &&
                  "border-primary/30 bg-primary/10 font-semibold text-primary hover:bg-primary/15",
                today &&
                  !selectedDay &&
                  "ring-1 ring-inset ring-sky-500/40 bg-sky-500/5",
              )}
            >
              <span className={cn("text-xs", today && "font-semibold")}>
                {format(day, "d")}
              </span>
              {hasEvents ? (
                <span className="flex items-center gap-0.5">
                  {eventCount > 0 && eventCount <= 3 ? (
                    Array.from({ length: Math.min(eventCount, 3) }).map(
                      (_, index) => (
                        <span
                          key={index}
                          className={cn(
                            "rounded-full bg-sky-500",
                            compact ? "size-1" : "size-1.5",
                          )}
                        />
                      ),
                    )
                  ) : (
                    <span
                      className={cn(
                        "rounded-full bg-sky-500",
                        compact ? "size-1.5" : "size-2",
                      )}
                    />
                  )}
                </span>
              ) : (
                <span className={compact ? "h-1.5" : "h-2"} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { buildMonthDays }
