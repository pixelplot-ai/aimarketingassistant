import { OrganizerSidebar } from "@/components/layout/organizer-sidebar"

export default function OrganizerLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
      <OrganizerSidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-6">
        {children}
      </main>
    </div>
  )
}
