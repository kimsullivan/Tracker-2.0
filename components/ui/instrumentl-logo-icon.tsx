import { cn } from "@/lib/utils"

/** Instrumentl-style mark for the Lookback sidebar header (simplified for prototype). */
export function InstrumentlLogoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn(className)}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="32" height="32" rx="8" className="fill-persimmon-400" />
      <path
        d="M9 22 15 10l4 8 5-12"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
