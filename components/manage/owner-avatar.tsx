import { cn } from "@/lib/utils"
import { team } from "@/lib/manage/data"

export function OwnerAvatar({ id, size = 22 }: { id: string; size?: number }) {
  const member = team.find((t) => t.id === id)
  if (!member) return null
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: member.color,
        fontSize: Math.max(9, size * 0.4),
      }}
      title={member.name}
    >
      {member.initials}
    </span>
  )
}

export function OwnerCell({ id, nameClassName }: { id: string; nameClassName?: string }) {
  const member = team.find((t) => t.id === id)
  if (!member)
    return <span className={cn("truncate", nameClassName ?? "text-xs text-muted-foreground")}>—</span>
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <OwnerAvatar id={id} size={18} />
      <span className={cn("truncate", nameClassName ?? "text-xs text-foreground")}>{member.name.split(" ")[0]}</span>
    </div>
  )
}
