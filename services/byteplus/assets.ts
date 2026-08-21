/**
 * ModelArk private asset library Action APIs (LivenessFace / real-human).
 * These use the OpenAPI gateway + IAM AK/SK signing — not the Seedance Bearer API key.
 * POST https://ark.ap-southeast-1.byteplusapi.com/?Action=…&Version=2024-01-01
 */

import {
  getArkProjectName,
  getByteplusAccessKeyId,
  getByteplusArkOpenApiHost,
  getByteplusArkOpenApiRegion,
  getByteplusSecretAccessKey,
  getVisualValidateWebhookUrl,
} from "@/services/byteplus/config"
import { signByteplusOpenApiRequest } from "@/services/byteplus/openapi-sign"

const ACTION_VERSION = "2024-01-01"
const SERVICE = "ark"

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
  const host = getByteplusArkOpenApiHost()
  const signed = signByteplusOpenApiRequest({
    accessKeyId: getByteplusAccessKeyId(),
    secretAccessKey: getByteplusSecretAccessKey(),
    region: getByteplusArkOpenApiRegion(),
    service: SERVICE,
    host,
    method: "POST",
    action,
    version: ACTION_VERSION,
    body,
  })

  let response: Response
  try {
    response = await fetch(signed.url, {
      method: "POST",
      headers: signed.headers,
      body: signed.body,
    })
  } catch (err) {
    console.error(`[ark-asset] ${action} network error:`, err)
    throw new Error(`Could not reach ModelArk for ${action}.`)
  }

  const rawText = await response.text()
  if (!rawText.trim()) {
    throw new Error(
      `ModelArk ${action} returned an empty body (status ${response.status}). Check BYTEPLUS_ARK_OPENAPI_HOST / IAM credentials.`,
    )
  }

  let data: ArkErrorBody
  try {
    data = JSON.parse(rawText) as ArkErrorBody
  } catch {
    console.error(`[ark-asset] ${action} non-JSON:`, rawText.slice(0, 300))
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
      requestId: data.ResponseMetadata?.RequestId,
    })
    throw new Error(message)
  }

  if (data.Result == null) {
    throw new Error(`ModelArk ${action} returned no Result.`)
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
