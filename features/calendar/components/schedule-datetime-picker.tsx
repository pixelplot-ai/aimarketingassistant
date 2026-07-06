"use client"

import { format } from "date-fns"
import { CalendarClock, X } from "lucide-react"
import { useMemo, useState } from "react"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  formatScheduleDisplay,
  QUICK_TIMES,
  SCHEDULE_PRESETS,
  toTimeInputValue,
  mergeScheduleValue,
} from "@/features/calendar/lib/datetime"
import { cn } from "@/lib/utils"

interface ScheduleDateTimePickerProps {
  value: string | null | undefined
  onChange: (value: string | null) => void
  timezone?: string
  id?: string
  disabled?: boolean
  className?: string
}

export function ScheduleDateTimePicker({
  value,
  onChange,
  timezone = "UTC",
  id,
  disabled = false,
  className,
}: ScheduleDateTimePickerProps) {
  const [open, setOpen] = useState(false)

  const selectedDate = useMemo(() => {
    if (!value) {
      return new Date()
    }

    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed
  }, [value])

  const [pickerMonth, setPickerMonth] = useState(() => selectedDate)
  const timeValue = toTimeInputValue(value, timezone)

  const displayLabel = value
    ? formatScheduleDisplay(value, timezone)
    : "Pick date & time"

  const isFuture = value ? new Date(value).getTime() > Date.now() : false

  function updateSchedule(date: Date, time: string) {
    onChange(mergeScheduleValue(date, time, timezone))
  }

  function applyPreset(getValue: (timezone: string) => Date) {
    const presetDate = getValue(timezone)
    onChange(presetDate.toISOString())
    setPickerMonth(presetDate)
    setOpen(false)
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              id={id}
              disabled={disabled}
              className={cn(
                "h-9 w-full justify-between px-3 font-normal",
                !value && "text-muted-foreground",
              )}
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <CalendarClock className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <span className="truncate">{displayLabel}</span>
          </span>
          {value ? (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
                isFuture
                  ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {isFuture ? "Scheduled" : "Past"}
            </span>
          ) : null}
        </PopoverTrigger>

        <PopoverContent className="w-auto max-w-[min(100vw-2rem,22rem)] p-0" align="start">
          <div className="border-b p-3">
            <Calendar
              month={pickerMonth}
              selected={value ? selectedDate : null}
              compact
              onMonthChange={setPickerMonth}
              onSelect={(date) => updateSchedule(date, timeValue)}
            />
          </div>

          <div className="space-y-3 p-3">
            <p className="text-xs text-muted-foreground">
              Times are interpreted in{" "}
              <span className="font-medium text-foreground">{timezone}</span>.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor={`${id ?? "schedule"}-time`} className="text-xs">
                Time ({timezone})
              </Label>
              <Input
                id={`${id ?? "schedule"}-time`}
                type="time"
                value={timeValue}
                onChange={(event) =>
                  updateSchedule(selectedDate, event.target.value)
                }
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_TIMES.map((time) => (
                <Button
                  key={time}
                  type="button"
                  variant={timeValue === time ? "secondary" : "outline"}
                  size="xs"
                  onClick={() => updateSchedule(selectedDate, time)}
                >
                  {format(
                    new Date(`1970-01-01T${time}:00`),
                    "h:mm a",
                  )}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-1.5 border-t pt-3">
              {SCHEDULE_PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => applyPreset(preset.getValue)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                <X className="size-4" />
                Clear schedule
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
