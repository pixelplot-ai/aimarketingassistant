import { AppSidebar } from "@/components/layout/app-sidebar"

export default function VideoLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
      <AppSidebar />
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
        {children}
      </main>
    </div>
  )
}
