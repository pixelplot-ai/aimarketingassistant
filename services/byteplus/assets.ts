/**
 * ModelArk private asset library Action APIs (LivenessFace / real-human).
 * POST {baseUrl}?Action=…&Version=2024-01-01
 */

import {
  getArkProjectName,
  getByteplusArkApiKey,
  getByteplusArkBaseUrl,
  getVisualValidateWebhookUrl,
} from "@/services/byteplus/config"

const ACTION_VERSION = "2024-01-01"

interface ArkErrorBody {
  ResponseMetadata?: {
    Error?: {
      Code?: string
      Message?: string
    }
    RequestId?: string
  }
  Result?: unknown
}

async function callArkAction<T>(
  action: string,
  body: Record<string, unknown>,
): Promise<T> {
  const apiKey = getByteplusArkApiKey()
  const baseUrl = getByteplusArkBaseUrl()
  const url = `${baseUrl}?Action=${encodeURIComponent(action)}&Version=${encodeURIComponent(ACTION_VERSION)}`

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error(`[ark-asset] ${action} network error:`, err)
    throw new Error(`Could not reach ModelArk for ${action}.`)
  }

  const rawText = await response.text()
  let data: ArkErrorBody
  try {
    data = JSON.parse(rawText) as ArkErrorBody
  } catch {
    throw new Error(
      `ModelArk ${action} returned non-JSON (status ${response.status}).`,
    )
  }

  const errorCode = data.ResponseMetadata?.Error?.Code
  const errorMessage = data.ResponseMetadata?.Error?.Message
  if (!response.ok || errorCode) {
    const message =
      errorMessage ||
      errorCode ||
      `ModelArk ${action} failed with status ${response.status}`
    console.error(`[ark-asset] ${action} rejected:`, {
      status: response.status,
      errorCode,
      errorMessage,
    })
    throw new Error(message)
  }

  return data.Result as T
}

export interface VisualValidateSession {
  bytedToken: string
  h5Link: string
  callbackUrl: string
}

export async function createVisualValidateSession(): Promise<VisualValidateSession> {
  const result = await callArkAction<{
    BytedToken?: string
    H5Link?: string
    CallbackURL?: string
  }>("CreateVisualValidateSession", {
    CallbackURL: getVisualValidateWebhookUrl(),
    ProjectName: getArkProjectName(),
  })

  const bytedToken = result.BytedToken?.trim()
  const h5Link = result.H5Link?.trim()
  if (!bytedToken || !h5Link) {
    throw new Error("ModelArk did not return a verification session.")
  }

  return {
    bytedToken,
    h5Link,
    callbackUrl: result.CallbackURL?.trim() || getVisualValidateWebhookUrl(),
  }
}

export async function getVisualValidateResult(
  bytedToken: string,
): Promise<string | null> {
  const result = await callArkAction<{ GroupId?: string }>(
    "GetVisualValidateResult",
    {
      BytedToken: bytedToken,
      ProjectName: getArkProjectName(),
    },
  )

  const groupId = result.GroupId?.trim()
  return groupId || null
}

export interface CreateAssetResult {
  id: string
}

export async function createImageAsset(input: {
  groupId: string
  url: string
  name: string
}): Promise<CreateAssetResult> {
  const result = await callArkAction<{ Id?: string }>("CreateAsset", {
    GroupId: input.groupId,
    URL: input.url,
    Name: input.name.slice(0, 64) || "avatar",
    AssetType: "Image",
    ProjectName: getArkProjectName(),
  })

  const id = result.Id?.trim()
  if (!id) {
    throw new Error("ModelArk did not return an asset id.")
  }
  return { id }
}

export type ArkAssetStatus = "Processing" | "Active" | "Failed" | string

export interface GetAssetResult {
  id: string
  status: ArkAssetStatus
  error?: string | null
}

export async function getAsset(assetId: string): Promise<GetAssetResult> {
  const result = await callArkAction<{
    Id?: string
    Status?: string
    ErrorMessage?: string
    Message?: string
  }>("GetAsset", {
    Id: assetId,
    ProjectName: getArkProjectName(),
  })

  return {
    id: result.Id?.trim() || assetId,
    status: (result.Status?.trim() || "Processing") as ArkAssetStatus,
    error: result.ErrorMessage?.trim() || result.Message?.trim() || null,
  }
}

export function mapArkAssetStatus(
  status: ArkAssetStatus,
): "processing" | "active" | "failed" {
  const normalized = status.trim().toLowerCase()
  if (normalized === "active") return "active"
  if (normalized === "failed" || normalized === "fail") return "failed"
  return "processing"
}
