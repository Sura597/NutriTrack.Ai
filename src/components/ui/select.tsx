import * as React from "react";
import { cn } from "@/lib/utils";

/** Native select: best mobile UX and fully keyboard/screen-reader accessible. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn("flex h-11 w-full rounded-xl border border-input bg-card px-3 text-base disabled:opacity-50 sm:text-sm", className)}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
