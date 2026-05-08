"use client";

import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarIcon, ChevronDown, Clock3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { ProfileSelectOption } from "./profile-types";

const profileDropdownTriggerClassName =
  "h-12 w-full justify-between rounded-2xl border-white/10 bg-black/20 px-4 text-zinc-100 hover:bg-white/8 hover:text-white";

interface ProfileDropdownFieldProps {
  label: string;
  placeholder: string;
  value: string;
  options: ProfileSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  contentClassName?: string;
}

export function ProfileDropdownField({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled = false,
  contentClassName,
}: ProfileDropdownFieldProps) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-zinc-200">{label}</div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            type="button"
            variant="outline"
            className={cn(
              profileDropdownTriggerClassName,
              !selectedOption && "text-zinc-500",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <span className="truncate">{selectedOption?.label ?? placeholder}</span>
            <ChevronDown className="size-4 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className={cn(
            "w-(--radix-dropdown-menu-trigger-width) border-white/10 bg-[#12141d] text-zinc-100",
            contentClassName,
          )}
        >
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
            {options.map((option) => (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="items-start py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-zinc-100">{option.label}</span>
                  {option.description ? (
                    <span className="text-xs text-zinc-500">{option.description}</span>
                  ) : null}
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface ProfileDatePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ProfileDatePickerField({
  label,
  value,
  onChange,
}: ProfileDatePickerFieldProps) {
  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-zinc-200">{label}</div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              profileDropdownTriggerClassName,
              "justify-start text-left font-normal",
              !selectedDate && "text-zinc-500",
            )}
          >
            <CalendarIcon className="size-4 shrink-0" />
            <span className="truncate">
              {selectedDate
                ? format(selectedDate, "yyyy년 M월 d일", { locale: ko })
                : "생년월일을 선택하세요"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto border-white/10 bg-[#12141d] p-0 text-zinc-100"
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              onChange(date ? format(date, "yyyy-MM-dd") : "");
            }}
            locale={ko}
            captionLayout="dropdown"
            fromYear={1930}
            toYear={new Date().getFullYear()}
            defaultMonth={selectedDate}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface ProfileTimeInputFieldProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function ProfileTimeInputField({
  value,
  disabled = false,
  onChange,
}: ProfileTimeInputFieldProps) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-zinc-200">출생시각</div>
      <div className="relative">
        <Clock3 className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-zinc-500" />
        <Input
          aria-label="출생시각 입력"
          type="time"
          step={60}
          disabled={disabled}
          className="h-12 rounded-2xl border-white/10 bg-black/20 pl-11 text-zinc-100 scheme-dark disabled:cursor-not-allowed disabled:opacity-50"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      </div>
      <div className="text-xs text-zinc-500">1분 단위로 직접 입력할 수 있습니다.</div>
    </div>
  );
}
