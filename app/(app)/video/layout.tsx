import { AppSidebar } from "@/components/layout/app-sidebar"

export default function VideoLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <>
      <AppSidebar />
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </>
  )
}
