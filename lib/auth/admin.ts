function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function getAdminEmails(): string[] {
  const fromList = process.env.ADMIN_EMAILS?.split(",") ?? []
  const emails = fromList
    .map((email) => email.trim())
    .filter((email) => email.length > 0)

  if (emails.length > 0) {
    return emails.map(normalizeEmail)
  }

  const single = process.env.ADMIN_EMAIL?.trim()
  if (single) {
    return [normalizeEmail(single)]
  }

  return []
}

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) {
    return false
  }

  const normalized = normalizeEmail(email)
  return getAdminEmails().includes(normalized)
}
