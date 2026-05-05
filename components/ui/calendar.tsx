"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import * as React from "react";
import { DayPicker, getDefaultClassNames, type ChevronProps } from "react-day-picker";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function CalendarChevron({ className, orientation, ...props }: ChevronProps) {
  if (orientation === "left") {
    return <ChevronLeftIcon className={cn("size-4", className)} {...props} />;
  }

  return <ChevronRightIcon className={cn("size-4", className)} {...props} />;
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("bg-background p-3", className)}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("flex flex-col gap-4", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        month_caption: cn(
          "relative flex items-center justify-center",
          defaultClassNames.month_caption,
        ),
        caption_label: cn("text-sm font-medium", defaultClassNames.caption_label),
        nav: cn(
          "absolute inset-x-0 top-0 flex items-center justify-between",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "size-7 p-0 text-zinc-100 hover:bg-white/8 hover:text-white",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "size-7 p-0 text-zinc-100 hover:bg-white/8 hover:text-white",
          defaultClassNames.button_next,
        ),
        weekdays: cn("mt-3 flex", defaultClassNames.weekdays),
        weekday: cn("w-9 text-xs font-medium text-zinc-500", defaultClassNames.weekday),
        week: cn("mt-1 flex w-full", defaultClassNames.week),
        day: cn("h-9 w-9 p-0 text-center", defaultClassNames.day),
        day_button: cn(
          "flex size-9 items-center justify-center rounded-md text-sm text-zinc-100 hover:bg-white/8",
          defaultClassNames.day_button,
        ),
        today: cn("bg-white/8 text-white", defaultClassNames.today),
        selected: cn(
          "bg-cyan-300/85 text-zinc-950 hover:bg-cyan-300",
          defaultClassNames.selected,
        ),
        outside: cn("text-zinc-600", defaultClassNames.outside),
        disabled: cn("text-zinc-700 opacity-50", defaultClassNames.disabled),
        chevron: cn("fill-zinc-100", defaultClassNames.chevron),
        ...classNames,
      }}
      components={{
        Chevron: CalendarChevron,
      }}
      {...props}
    />
  );
}

export { Calendar };
