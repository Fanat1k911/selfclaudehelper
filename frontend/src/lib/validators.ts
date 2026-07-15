export function sanitizePhone(raw: string): string {
  return raw.replace(/[^0-9+\-()\s]/g, '')
}

export function sanitizeDigits(raw: string): string {
  return raw.replace(/[^0-9]/g, '')
}
