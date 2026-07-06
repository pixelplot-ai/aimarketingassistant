import type { Metadata } from "next"
import { Package } from "lucide-react"

import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { getProducts } from "@/features/products/actions"
import { ProductForm } from "@/features/products/components/product-form"
import { ProductsTable } from "@/features/products/components/products-table"
import { createAdminSignedUrl } from "@/services/storage/upload"

export const metadata: Metadata = {
  title: "Products & Services",
}

export default async function ProductsPage() {
  const result = await getProducts()

  if (!result.success) {
    throw new Error(result.error)
  }

  const products = result.data

  const imageUrlEntries = await Promise.all(
    products.map(async (p) => {
      if (p.image_storage_path) {
        const url = await createAdminSignedUrl("product-images", p.image_storage_path, 60 * 60)
        if (url) return [p.id, url] as const
      }
      // Fallback: original external URL stored in metadata (used when CDN blocks server-side download)
      const meta = p.metadata as Record<string, unknown> | null
      const externalUrl = typeof meta?.original_image_url === "string" ? meta.original_image_url : null
      return [p.id, externalUrl] as const
    }),
  )

  const imageUrls: Record<string, string> = {}
  for (const [id, url] of imageUrlEntries) {
    if (url) imageUrls[id] = url
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

      <ProductsTable products={products} imageUrls={imageUrls} />
    </div>
  )
}
