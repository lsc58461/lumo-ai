"use client";

import { ChevronDown, Clock3 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);

function padTimeUnit(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatTimeValue(hour: number, minute: number): string {
  return `${padTimeUnit(hour)}:${padTimeUnit(minute)}`;
}

function parseTimeValue(value: string): { hour: number; minute: number } | null {
  const matchedValue = value.match(/^(\d{2}):(\d{2})$/);

  if (!matchedValue) {
    return null;
  }

  const hour = Number.parseInt(matchedValue[1], 10);
  const minute = Number.parseInt(matchedValue[2], 10);

  if (
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  return { hour, minute };
}

function getNextTimeValue(
  currentValue: string,
  updates: Partial<{ hour: number; minute: number }>,
): string {
  const parsedTimeValue = parseTimeValue(currentValue);

  return formatTimeValue(
    updates.hour ?? parsedTimeValue?.hour ?? 12,
    updates.minute ?? parsedTimeValue?.minute ?? 0,
  );
}

function handleListWheel(event: React.WheelEvent<HTMLDivElement>): void {
  const scrollContainer = event.currentTarget;

  scrollContainer.scrollTop += event.deltaY;
  event.preventDefault();
}

interface ProfileTimePickerProps {
  value: string;
  disabled?: boolean;
  triggerClassName: string;
  onChange: (value: string) => void;
}

export function ProfileTimePicker({
  value,
  disabled = false,
  triggerClassName,
  onChange,
}: ProfileTimePickerProps) {
  const parsedTimeValue = parseTimeValue(value);
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!parsedTimeValue}
          className={cn(
            triggerClassName,
            "justify-start text-left font-normal disabled:cursor-not-allowed disabled:opacity-50 data-[empty=true]:text-zinc-500",
          )}
        >
          <Clock3 className="size-4 shrink-0" />
          <span className="flex-1 truncate">
            {parsedTimeValue
              ? formatTimeValue(parsedTimeValue.hour, parsedTimeValue.minute)
              : "출생시각을 선택하세요"}
          </span>
          <ChevronDown className="size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        collisionPadding={16}
        className="w-70 rounded-2xl border-white/10 bg-[#12141d] p-0 text-zinc-100"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-sm font-medium text-zinc-100">출생시각 선택</div>
            <div className="text-xs text-zinc-500">24시간 기준으로 시와 분을 고르세요.</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs text-zinc-400 hover:bg-white/6 hover:text-white"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            지우기
          </Button>
        </div>
        <Separator className="bg-white/10" />
        <div className="grid grid-cols-[1fr_auto_1fr] gap-0 p-3">
          <div className="min-w-0">
            <div className="px-2 pb-2 text-xs font-medium tracking-wide text-zinc-500">시</div>
            <div
              className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 h-56 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/20"
              onWheelCapture={handleListWheel}
            >
              <div className="grid gap-1 p-2">
                {HOURS.map((hour) => {
                  const isSelected = parsedTimeValue?.hour === hour;

                  return (
                    <Button
                      key={hour}
                      type="button"
                      variant="ghost"
                      className={cn(
                        "h-9 justify-center rounded-xl text-sm text-zinc-300 hover:bg-white/8 hover:text-white",
                        isSelected &&
                          "bg-cyan-300/85 font-semibold text-zinc-950 hover:bg-cyan-300 hover:text-zinc-950",
                      )}
                      onClick={() => {
                        onChange(getNextTimeValue(value, { hour }));
                      }}
                    >
                      {padTimeUnit(hour)}시
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center px-1 text-sm font-medium text-zinc-600">
            :
          </div>
          <div className="min-w-0">
            <div className="px-2 pb-2 text-xs font-medium tracking-wide text-zinc-500">분</div>
            <div
              className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 h-56 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/20"
              onWheelCapture={handleListWheel}
            >
              <div className="grid gap-1 p-2">
                {MINUTES.map((minute) => {
                  const isSelected = parsedTimeValue?.minute === minute;

                  return (
                    <Button
                      key={minute}
                      type="button"
                      variant="ghost"
                      className={cn(
                        "h-9 justify-center rounded-xl text-sm text-zinc-300 hover:bg-white/8 hover:text-white",
                        isSelected &&
                          "bg-cyan-300/85 font-semibold text-zinc-950 hover:bg-cyan-300 hover:text-zinc-950",
                      )}
                      onClick={() => {
                        onChange(getNextTimeValue(value, { minute }));
                      }}
                    >
                      {padTimeUnit(minute)}분
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
