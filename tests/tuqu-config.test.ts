import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTuquRegistrationUrl,
  TUQU_BILLING_DASHBOARD_URL,
  TUQU_BILLING_LOGIN_URL
} from "../lib/tuqu-config.ts";

test("normalizeTuquRegistrationUrl upgrades the legacy login URL to the dashboard URL", () => {
  assert.equal(normalizeTuquRegistrationUrl(TUQU_BILLING_LOGIN_URL), TUQU_BILLING_DASHBOARD_URL);
});

test("normalizeTuquRegistrationUrl falls back to the dashboard URL when unset", () => {
  assert.equal(normalizeTuquRegistrationUrl(undefined), TUQU_BILLING_DASHBOARD_URL);
});

test("normalizeTuquRegistrationUrl keeps custom non-legacy URLs", () => {
  assert.equal(
    normalizeTuquRegistrationUrl("https://example.com/custom-tuqu-entry"),
    "https://example.com/custom-tuqu-entry"
  );
});
