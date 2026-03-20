import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    (<input
      type={type}
      className={cn(
        "flex min-h-[48px] w-full rounded-xl border border-border/80 bg-white/90 px-4 py-3 text-base shadow-sm transition-all touch-manipulation file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:px-3 sm:py-2 sm:text-sm",
        className
      )}
      ref={ref}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }