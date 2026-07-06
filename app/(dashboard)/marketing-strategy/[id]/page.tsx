import type { Metadata } from "next"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCampaign } from "@/features/marketing-strategy/actions"
import { CampaignForm } from "@/features/marketing-strategy/components/campaign-form"
import { StrategyView } from "@/features/marketing-strategy/components/strategy-view"
import { getProducts } from "@/features/products/actions"
import { parseStrategySteps } from "@/lib/validations/marketing-campaign"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const result = await getCampaign(id)

  if (!result.success) {
    return { title: "Campaign" }
  }

  return { title: result.data.name }
}

interface CampaignDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function CampaignDetailPage({
  params,
}: CampaignDetailPageProps) {
  const { id } = await params
  const [campaignResult, productsResult] = await Promise.all([
    getCampaign(id),
    getProducts(),
  ])

  if (!campaignResult.success) {
    if (campaignResult.error === "You must be signed in to continue.") {
      redirect("/login")
    }
    if (campaignResult.error === "Campaign not found.") {
      notFound()
    }
    throw new Error(campaignResult.error)
  }

  const campaign = campaignResult.data
  const products = productsResult.success ? productsResult.data : []
  const hasStrategy = parseStrategySteps(campaign.strategy).length > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        description={campaign.campaign_goal}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {campaign.is_active ? <Badge>Active</Badge> : null}
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<Link href="/marketing-strategy" />}
            >
              <ArrowLeft className="size-4" />
              All campaigns
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Campaign details</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignForm
            products={products}
            campaign={campaign}
            hasStrategy={hasStrategy}
          />
        </CardContent>
      </Card>

      <StrategyView campaign={campaign} />
    </div>
  )
}
