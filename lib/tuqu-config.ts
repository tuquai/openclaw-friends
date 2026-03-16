export const TUQU_BILLING_LOGIN_URL = "https://billing.tuqu.ai/dream-weaver/login";
export const TUQU_BILLING_DASHBOARD_URL = "https://billing.tuqu.ai/dream-weaver/dashboard";

export function normalizeTuquRegistrationUrl(registrationUrl?: string) {
  const candidate = registrationUrl?.trim();

  if (!candidate || candidate === TUQU_BILLING_LOGIN_URL) {
    return TUQU_BILLING_DASHBOARD_URL;
  }

  return candidate;
}
