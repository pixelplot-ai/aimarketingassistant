import { AppError } from "@/lib/errors/app-error"

export async function fetchPageHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      throw new AppError({
        code: "EXTERNAL_SERVICE",
        message: `HTTP ${res.status} fetching ${url}`,
        userMessage: `Could not access the URL (HTTP ${res.status}). Please check the address and try again.`,
      })
    }

    return res.text()
  } catch (err) {
    if (AppError.isAppError(err)) {
      throw err
    }

    throw new AppError({
      code: "EXTERNAL_SERVICE",
      message: err instanceof Error ? err.message : "Fetch failed",
      userMessage:
        "Could not reach the URL. Please check your connection and try again.",
    })
  }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim()
}

export function prepareTextContent(html: string, maxChars = 14000): string {
  return stripHtml(html).slice(0, maxChars)
}
