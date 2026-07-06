"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTransition, useState } from "react"
import { toast } from "sonner"
import {
  CheckCircle2,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Star,
  Trash2,
} from "lucide-react"

import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  deleteCampaign,
  setActiveCampaign,
} from "@/features/marketing-strategy/actions"
import type { MarketingCampaignWithProgress } from "@/types/app"

interface CampaignsTableProps {
  campaigns: MarketingCampaignWithProgress[]
}

function ProgressCell({ campaign }: { campaign: MarketingCampaignWithProgress }) {
  const steps = campaign.totalSteps
  const completed = campaign.completedCount
  const hasStrategy = steps > 0 && parseStrategyExists(campaign)

  if (!hasStrategy) {
    return <span className="text-sm text-muted-foreground">Not generated</span>
  }

  const percent = steps > 0 ? Math.round((completed / steps) * 100) : 0

  return (
    <div className="min-w-[140px] space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          {completed} / {steps}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function parseStrategyExists(campaign: MarketingCampaignWithProgress): boolean {
  return Array.isArray(campaign.strategy) && campaign.strategy.length > 0
}

function ActionsMenu({ campaign }: { campaign: MarketingCampaignWithProgress }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [isDeleting, startDelete] = useTransition()
  const [isActivating, startActivate] = useTransition()

  function handleDelete() {
    startDelete(async () => {
      const result = await deleteCampaign(campaign.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Campaign deleted")
      setConfirmOpen(false)
      router.refresh()
    })
  }

  function handleSetActive() {
    startActivate(async () => {
      const result = await setActiveCampaign(campaign.id)
      if (!result.success) {
        toast.error(result.error)
        return
      }
      toast.success("Campaign set as active")
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label="Actions" />}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/marketing-strategy/${campaign.id}`} />}>
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          {!campaign.is_active ? (
            <DropdownMenuItem onClick={handleSetActive} disabled={isActivating}>
              <Star className="mr-2 size-4" />
              Set as active
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete campaign?"
        description={`"${campaign.name}" and its strategy will be permanently removed.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  )
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  const router = useRouter()

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No marketing campaigns yet"
        description="Create a campaign to generate an AI-powered day-by-day content strategy."
      />
    )
  }

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow
              key={campaign.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() =>
                router.push(`/marketing-strategy/${campaign.id}`)
              }
            >
              <TableCell className="font-medium">{campaign.name}</TableCell>
              <TableCell>{campaign.duration_days} days</TableCell>
              <TableCell>
                <ProgressCell campaign={campaign} />
              </TableCell>
              <TableCell>
                {campaign.is_active ? (
                  <Badge className="gap-1">
                    <CheckCircle2 className="size-3" />
                    Active
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell onClick={(event) => event.stopPropagation()}>
                <ActionsMenu campaign={campaign} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
