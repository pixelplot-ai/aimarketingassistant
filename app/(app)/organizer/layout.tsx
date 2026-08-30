import { OrganizerSidebar } from "@/components/layout/organizer-sidebar"

export default function OrganizerLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <OrganizerSidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col p-6">
        {children}
      </main>
    </>
  )
}
