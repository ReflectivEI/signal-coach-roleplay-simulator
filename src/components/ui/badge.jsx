import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full whitespace-nowrap border px-3 py-1 text-xs font-semibold leading-5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-teal-600 bg-teal-600 text-white shadow-sm hover:bg-teal-700",
        secondary:
          "border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:text-teal-700",
        destructive:
          "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
        outline: "border-slate-200 bg-white text-slate-700 hover:bg-teal-50 hover:text-teal-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
