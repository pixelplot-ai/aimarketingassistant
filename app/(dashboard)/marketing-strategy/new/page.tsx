import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CampaignForm } from "@/features/marketing-strategy/components/campaign-form"
import { getProducts } from "@/features/products/actions"

export const metadata: Metadata = {
  title: "New Campaign",
}

export default async function NewCampaignPage() {
  const productsResult = await getProducts()
  const products = productsResult.success ? productsResult.data : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="New campaign"
        description="Define your campaign goals and optional products before generating a strategy."
        actions={
          <Button
            nativeButton={false}
            variant="outline"
            size="sm"
            render={<Link href="/marketing-strategy" />}
          >
            <ArrowLeft className="size-4" />
            All campaigns
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Campaign details</CardTitle>
        </CardHeader>
        <CardContent>
          <CampaignForm products={products} />
        </CardContent>
      </Card>
    </div>
  )
}
