import { Button } from "@/components/ui/button"
import { SeedancePlayground } from "@/features/seedance/seedance-playground"
import { signOut } from "@/features/auth/actions"
import { requireAuth } from "@/lib/auth/require-auth"

export default async function HomePage() {
  const user = await requireAuth()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <p className="text-sm font-medium">Pixelplot · Seedance</p>
        <div className="flex items-center gap-3">
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <main className="flex-1 p-6">
        <SeedancePlayground userId={user.id} />
      </main>
    </div>
  )
}
