import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
<<<<<<< HEAD
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
=======
  "inline-flex items-center justify-center rounded-full whitespace-nowrap border px-3 py-1 text-xs font-semibold leading-5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
>>>>>>> f9564108d7fe619378852cbd8085e729086b6966
  {
    variants: {
      variant: {
        default:
<<<<<<< HEAD
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
=======
          "border-teal-600 bg-teal-600 text-white shadow-sm hover:bg-teal-700",
        secondary:
          "border-slate-200 bg-slate-50 text-slate-700 hover:bg-teal-50 hover:text-teal-700",
        destructive:
          "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
        outline: "border-slate-200 bg-white text-slate-700 hover:bg-teal-50 hover:text-teal-700",
>>>>>>> f9564108d7fe619378852cbd8085e729086b6966
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
