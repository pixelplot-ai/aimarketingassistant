"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { ProductRow } from "@/features/products/actions"

interface ProductMultiSelectProps {
  products: ProductRow[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}

export function ProductMultiSelect({
  products,
  value,
  onChange,
  disabled = false,
}: ProductMultiSelectProps) {
  function toggle(id: string, checked: boolean) {
    if (checked) {
      onChange([...new Set([...value, id])])
      return
    }
    onChange(value.filter((item) => item !== id))
  }

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No products or services yet. Add them on the Products page to include
        them in campaigns.
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      {products.map((product) => {
        const checked = value.includes(product.id)
        return (
          <div key={product.id} className="flex items-center gap-2">
            <Checkbox
              id={`campaign-product-${product.id}`}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(next) => toggle(product.id, next === true)}
            />
            <Label
              htmlFor={`campaign-product-${product.id}`}
              className="cursor-pointer font-normal"
            >
              {product.name}
            </Label>
          </div>
        )
      })}
    </div>
  )
}
