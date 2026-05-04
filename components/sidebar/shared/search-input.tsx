import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onClick?: () => void
  placeholder?: string
  size?: "sm" | "md"
  className?: string
}

export function SearchInput({ 
  value, 
  onChange, 
  onClick,
  placeholder = "Search all",
  size = "md",
  className
}: SearchInputProps) {
  const heightClass = size === "sm" ? "h-8" : "h-9"
  const iconPadding = size === "sm" ? "w-8 p-1.5" : "w-9 p-2"
  
  return (
    <div className={cn("relative w-full", className)}>
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={onClick}
        className={cn(
          "pl-2 pr-8 border border-silver-300 rounded-lg font-light text-[#333] focus:border-[#66afe9] focus:shadow-[inset_0_1px_1px_rgba(0,0,0,0.075),0_0_8px_rgba(102,175,233,0.6)] focus:outline-none focus:ring-none focus-visible:outline-none focus-visible:ring-0",
          heightClass,
          size === "sm" && "text-[14px]"
        )}
      />
      <div className={cn(
        "absolute right-0 top-0 flex items-center justify-center text-muted-foreground border-l border-silver-300",
        heightClass,
        iconPadding
      )}>
        <Search className="h-4 w-4 text-[#333]" strokeWidth={1.5} aria-hidden />
      </div>
    </div>
  )
}
