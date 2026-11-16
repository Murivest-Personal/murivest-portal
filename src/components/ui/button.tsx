import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        /* Pill primary — solid forest, spring press handled by .press-scale. */
        default:
          "rounded-pill bg-primary text-primary-foreground shadow-card px-5 hover:bg-primary/90 active:bg-primary/95",
        /* Solid destructive — reserved for confirmation modals. */
        destructive:
          "rounded-pill bg-destructive text-white shadow-card px-5 hover:bg-destructive/90",
        /* Outline destructive — the default destructive presentation. */
        destructiveOutline:
          "rounded-standard border-[1.5px] border-destructive/60 bg-transparent text-destructive px-4 hover:bg-destructive/5 active:bg-destructive/10",
        /* Secondary — 1.5px neutral border, transparent surface. */
        outline:
          "rounded-standard border-[1.5px] border-border bg-transparent text-primary px-4 hover:border-gold hover:text-gold hover:bg-gold/5",
        /* Gold-keyed secondary for tier/confidential actions. */
        outlineGold:
          "rounded-standard border-[1.5px] border-gold/50 bg-transparent text-primary px-4 hover:border-gold hover:bg-gold/5 active:bg-gold/10",
        secondary:
          "rounded-standard border-[1.5px] border-transparent bg-secondary text-secondary-foreground px-4 hover:bg-secondary/80",
        ghost:
          "rounded-standard px-3 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-standard gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-11 rounded-pill px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-standard",
        iconPill: "size-9 rounded-pill",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn("press-scale", buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
