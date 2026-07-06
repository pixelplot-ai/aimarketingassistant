"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { AlertCircle } from "lucide-react"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { signInWithEmail } from "@/features/auth/actions"
import { GoogleSignInButton } from "@/features/auth/components/google-sign-in-button"

const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginFormValues = z.infer<typeof loginSchema>

const SEARCH_PARAM_ERRORS: Record<string, string> = {
  unauthorized:
    "Your account is not authorized to access this application. Contact the administrator if you believe this is a mistake.",
  oauth: "Google sign-in failed. Please try again.",
  auth: "Authentication failed. Please try again.",
}

function getErrorMessage(error: string | undefined): string | null {
  if (!error) {
    return null
  }

  return SEARCH_PARAM_ERRORS[error] ?? decodeURIComponent(error)
}

interface LoginFormProps {
  error?: string
}

export function LoginForm({ error }: LoginFormProps) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const urlError = getErrorMessage(error)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = handleSubmit((values) => {
    setSubmitError(null)

    startTransition(async () => {
      const result = await signInWithEmail(values)

      if (result?.error) {
        setSubmitError(result.error)
      }
    })
  })

  const displayError = submitError ?? urlError

  return (
    <div className="flex flex-col gap-6">
      {displayError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Sign in failed</AlertTitle>
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      ) : null}

      <GoogleSignInButton />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            disabled={isPending}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            disabled={isPending}
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : null}
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  )
}
