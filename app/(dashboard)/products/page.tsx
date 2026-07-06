import type { Metadata } from "next"
import { Package } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { getProducts } from "@/features/products/actions"
import { ProductForm } from "@/features/products/components/product-form"
import { ProductsTable } from "@/features/products/components/products-table"

export const metadata: Metadata = {
  title: "Products & Services",
}

export default async function ProductsPage() {
  const result = await getProducts()

  if (!result.success) {
    throw new Error(result.error)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Services"
        description="Add products and services to reference when creating posts."
        actions={
          <ProductForm
            trigger={
              <Button>
                <Package className="mr-2 size-4" />
                New Product
              </Button>
            }
          />
        }
      />

      <ProductsTable products={result.data} />
    </div>
  )
}
