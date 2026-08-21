import { createHash, createHmac } from "node:crypto"

function sha256Hex(payload) {
  return createHash("sha256").update(payload, "utf8").digest("hex")
}
function hmac(key, data) {
  return createHmac("sha256", key).update(data, "utf8").digest()
}

async function callAction(action, bodyObj) {
  const accessKeyId = process.env.BYTEPLUS_ACCESS_KEY_ID
  const secretAccessKey = process.env.BYTEPLUS_SECRET_ACCESS_KEY
  const host = "ark.ap-southeast-1.byteplusapi.com"
  const region = "ap-southeast-1"
  const service = "ark"
  const body = JSON.stringify(bodyObj)
  const payloadHash = sha256Hex(body)
  const now = new Date()
  const xDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
  const shortDate = xDate.slice(0, 8)
  const query = `Action=${action}&Version=2024-01-01`
  const headers = {
    "content-type": "application/json; charset=utf-8",
    host,
    "x-content-sha256": payloadHash,
    "x-date": xDate,
  }
  const signedHeaderNames = Object.keys(headers).map((n) => n.toLowerCase()).sort()
  const signedHeaders = signedHeaderNames.join(";")
  const canonicalHeaders = signedHeaderNames
    .map((n) => `${n}:${headers[n].trim()}\n`)
    .join("")
  const canonicalRequest = [
    "POST",
    "/",
    query,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")
  const credentialScope = `${shortDate}/${region}/${service}/request`
  const stringToSign = [
    "HMAC-SHA256",
    xDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n")
  const kDate = hmac(secretAccessKey, shortDate)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  const kSigning = hmac(kService, "request")
  const signature = createHmac("sha256", kSigning)
    .update(stringToSign, "utf8")
    .digest("hex")
  headers.authorization = `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  const r = await fetch(`https://${host}/?${query}`, {
    method: "POST",
    headers,
    body,
  })
  console.log("---", action, r.status)
  console.log(await r.text())
}

const groupId = "group-20260822005247-gxv6l"
for (const project of ["default", undefined]) {
  const body = { Id: groupId }
  if (project) body.ProjectName = project
  await callAction("GetAssetGroup", body)
}
await callAction("ListAssetGroups", { ProjectName: "default", PageNumber: 1, PageSize: 20 })
await callAction("GetAsset", {
  Id: "asset-20260822005350-c2gds",
  ProjectName: "default",
})
