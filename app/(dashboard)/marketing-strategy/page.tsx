import type { Metadata } from "next"
import Link from "next/link"
import { Megaphone } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { getCampaigns } from "@/features/marketing-strategy/actions"
import { CampaignsTable } from "@/features/marketing-strategy/components/campaigns-table"

export const metadata: Metadata = {
  title: "Marketing Strategy",
}

export default async function MarketingStrategyPage() {
  const result = await getCampaigns()

  if (!result.success) {
    throw new Error(result.error)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing Strategy"
        description="Create reusable AI-generated marketing campaigns with day-by-day content plans."
        actions={
          <Button nativeButton={false} render={<Link href="/marketing-strategy/new" />}>
            <Megaphone className="mr-2 size-4" />
            New Campaign
          </Button>
        }
      />

      <CampaignsTable campaigns={result.data} />
    </div>
  )
}
