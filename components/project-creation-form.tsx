"use client"

import { Button } from "@/components/ui/button"

export function ProjectCreationForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (projectId: string) => void
}) {
  return (
    <div className="space-y-4 p-2">
      <p className="text-sm text-muted-foreground">
        Prototype: full project creation is not wired. Use the button below to simulate creating a project.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={() => onSuccess("alpfa")}>
          Create sample project
        </Button>
      </div>
    </div>
  )
}
