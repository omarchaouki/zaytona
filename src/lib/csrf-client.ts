/**
 * Browser-side holder for the signed-in admin's CSRF token. The admin layout
 * sets it; the adminMutation middleware sends it as `x-csrf-token`.
 */
let token: string | null = null

export function setClientCsrfToken(value: string | null) {
  token = value
}

export function getClientCsrfToken() {
  return token
}

/** Minimum admin password length (shared by the form and the server). */
export const PASSWORD_MIN = 12
