<<<<<<< HEAD
=======
// @ts-nocheck
>>>>>>> f9564108d7fe619378852cbd8085e729086b6966
import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
<<<<<<< HEAD
    className={cn("rounded-xl border bg-card text-card-foreground shadow", className)}
=======
    className={cn(
      "rounded-3xl border border-slate-200/80 bg-white text-card-foreground shadow-[0_12px_28px_rgba(15,23,42,0.055)]",
      className
    )}
>>>>>>> f9564108d7fe619378852cbd8085e729086b6966
    {...props} />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
<<<<<<< HEAD
    className={cn("flex flex-col space-y-1.5 p-6", className)}
=======
    className={cn("flex flex-col space-y-1.5 p-5 md:p-6", className)}
>>>>>>> f9564108d7fe619378852cbd8085e729086b6966
    {...props} />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
<<<<<<< HEAD
    className={cn("font-semibold leading-none tracking-tight", className)}
=======
    className={cn("text-base font-semibold leading-snug tracking-tight", className)}
>>>>>>> f9564108d7fe619378852cbd8085e729086b6966
    {...props} />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
<<<<<<< HEAD
    className={cn("text-sm text-muted-foreground", className)}
=======
    className={cn("text-sm leading-relaxed text-muted-foreground", className)}
>>>>>>> f9564108d7fe619378852cbd8085e729086b6966
    {...props} />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
<<<<<<< HEAD
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
=======
  <div ref={ref} className={cn("p-5 pt-0 md:p-6 md:pt-0", className)} {...props} />
>>>>>>> f9564108d7fe619378852cbd8085e729086b6966
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
<<<<<<< HEAD
    className={cn("flex items-center p-6 pt-0", className)}
=======
    className={cn("flex items-center p-5 pt-0 md:p-6 md:pt-0", className)}
>>>>>>> f9564108d7fe619378852cbd8085e729086b6966
    {...props} />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
