import { cache } from "react"
import type { User } from "@supabase/supabase-js"

import { isAdminEmail } from "@/lib/auth/admin"
import { AppError } from "@/lib/errors/app-error"
import { requireAuth } from "@/lib/auth/require-auth"
import { createClient } from "@/services/supabase/server"

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseUuid(value: string | undefined): string | null {
  if (!value?.trim()) {
    return null
  }

  const trimmed = value.trim()
  if (!UUID_REGEX.test(trimmed)) {
    return null
  }

  return trimmed
}

export function getEnvWorkspaceOwnerId(): string | null {
  return parseUuid(process.env.WORKSPACE_OWNER_USER_ID)
}

async function readWorkspaceOwnerFromDb(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("owner_user_id")
    .eq("id", 1)
    .maybeSingle()

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to load workspace settings.",
    })
  }

  return data?.owner_user_id ?? null
}

export async function resolveWorkspaceOwnerId(): Promise<string | null> {
  const envOwner = getEnvWorkspaceOwnerId()
  if (envOwner) {
    return envOwner
  }

  return readWorkspaceOwnerFromDb()
}

export async function pinWorkspaceOwner(ownerId: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("pin_workspace_owner", {
    p_owner: ownerId,
  })

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to initialize workspace owner.",
    })
  }

  if (!data || typeof data !== "string") {
    throw new AppError({
      code: "INTERNAL",
      message: "pin_workspace_owner returned no owner id",
      userMessage: "Failed to initialize workspace owner.",
    })
  }

  return data
}

export async function bootstrapWorkspaceOwner(userId: string): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("bootstrap_workspace_owner", {
    p_claimant: userId,
  })

  if (error) {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to initialize workspace.",
    })
  }

  if (!data || typeof data !== "string") {
    throw new AppError({
      code: "INTERNAL",
      message: "bootstrap_workspace_owner returned no owner id",
      userMessage: "Failed to initialize workspace.",
    })
  }

  return data
}

export async function ensureWorkspaceMember(userId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("workspace_members")
    .insert({ user_id: userId })

  // Owner may already be inserted by pin/bootstrap RPC; ignore duplicate key.
  if (error && error.code !== "23505") {
    throw new AppError({
      code: "INTERNAL",
      message: error.message,
      userMessage: "Failed to register workspace member.",
    })
  }
}

export async function initializeWorkspaceForUser(userId: string): Promise<string> {
  const envOwner = getEnvWorkspaceOwnerId()
  const ownerId = envOwner
    ? await pinWorkspaceOwner(envOwner)
    : await bootstrapWorkspaceOwner(userId)

  await ensureWorkspaceMember(userId)

  if (envOwner && ownerId !== envOwner) {
    throw new AppError({
      code: "INTERNAL",
      message: `Workspace owner mismatch: expected ${envOwner}, got ${ownerId}`,
      userMessage:
        "Workspace owner is already set and does not match WORKSPACE_OWNER_USER_ID.",
    })
  }

  return ownerId
}

export const getWorkspaceOwnerId = cache(async (): Promise<string> => {
  const user = await requireAuth()

  if (!isAdminEmail(user.email)) {
    throw new AppError({
      code: "UNAUTHORIZED",
      message: "Not an admin user",
      userMessage: "You are not authorized to access this workspace.",
    })
  }

  const envOwner = getEnvWorkspaceOwnerId()
  const existing = await readWorkspaceOwnerFromDb()

  if (existing) {
    if (envOwner && existing !== envOwner) {
      throw new AppError({
        code: "INTERNAL",
        message: `Workspace owner mismatch: expected ${envOwner}, got ${existing}`,
        userMessage:
          "Workspace owner is already set and does not match WORKSPACE_OWNER_USER_ID.",
      })
    }

    return existing
  }

  if (envOwner) {
    const pinnedOwner = await pinWorkspaceOwner(envOwner)
    await ensureWorkspaceMember(user.id)

    if (pinnedOwner !== envOwner) {
      throw new AppError({
        code: "INTERNAL",
        message: `Workspace owner mismatch: expected ${envOwner}, got ${pinnedOwner}`,
        userMessage:
          "Workspace owner is already set and does not match WORKSPACE_OWNER_USER_ID.",
      })
    }

    return pinnedOwner
  }

  return initializeWorkspaceForUser(user.id)
})

export const getWorkspaceUserId = cache(async (): Promise<string> => {
  return getWorkspaceOwnerId()
})

export async function requireAdminAuth(): Promise<{
  user: User
  workspaceUserId: string
}> {
  const user = await requireAuth()

  if (!isAdminEmail(user.email)) {
    throw new AppError({
      code: "UNAUTHORIZED",
      message: "Not an admin user",
      userMessage: "You are not authorized to access this workspace.",
    })
  }

  const workspaceUserId = await initializeWorkspaceForUser(user.id)

  return { user, workspaceUserId }
}

export async function setupWorkspaceAfterLogin(userId: string): Promise<void> {
  await initializeWorkspaceForUser(userId)
}
