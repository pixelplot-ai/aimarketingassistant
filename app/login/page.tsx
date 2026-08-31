import type { Metadata } from "next"

import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { LoginForm } from "@/features/auth/components/login-form"

export const metadata: Metadata = {
  title: "Sign in",
}

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-6">
      <div className="absolute right-6 top-6">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Sign in with Google or your admin email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm error={error} />
        </CardContent>
      </Card>
    </div>
  )
}
