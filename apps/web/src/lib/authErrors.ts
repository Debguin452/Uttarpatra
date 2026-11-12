const KEYS: Record<string, string> = {
  "auth/invalid-credential": "err_invalid_credential",
  "auth/wrong-password": "err_invalid_credential",
  "auth/user-not-found": "err_invalid_credential",
  "auth/email-already-in-use": "err_email_in_use",
  "auth/weak-password": "err_weak_password",
  "auth/invalid-email": "err_invalid_email",
  "auth/too-many-requests": "err_too_many",
  "auth/network-request-failed": "err_network",
  "auth/account-exists-with-different-credential": "err_other_method",
  "auth/popup-blocked": "err_popup_blocked",
};

const SILENT = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export function authErrorKey(code: string): string | null {
  if (SILENT.has(code)) return null;
  return KEYS[code] ?? "something_wrong";
}
