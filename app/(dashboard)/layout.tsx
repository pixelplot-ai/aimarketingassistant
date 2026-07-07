import { Header } from "@/components/layout/header"
import { NavigationProgress } from "@/components/layout/navigation-progress"
import { Sidebar } from "@/components/layout/sidebar"
import { getSessionUser } from "@/lib/auth/session"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getSessionUser()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <NavigationProgress />
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header userEmail={user?.email} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
