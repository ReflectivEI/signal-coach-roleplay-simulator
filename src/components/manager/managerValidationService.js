import { buildValidationRecommendation, buildValidationSnapshot } from "./managerValidationLogic.js";

async function parseJsonResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `validation_request_${response.status}`);
  }
  return payload;
}

export async function fetchValidationRecords(repId) {
  const response = await fetch(`/api/manager/validation/rep/${encodeURIComponent(repId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return parseJsonResponse(response);
}

export async function fetchValidationSummary() {
  const response = await fetch("/api/manager/validation/summary", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return parseJsonResponse(response);
}

export async function startValidationRecord(rep, derived, validationAnalytics = null) {
  const recommendation = buildValidationRecommendation(rep, derived, validationAnalytics);
  const baselineSnapshot = buildValidationSnapshot(rep, derived);
  const response = await fetch("/api/manager/validation/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repId: rep.id,
      repName: rep.name,
      territoryId: rep.territory,
      territoryName: rep.territory,
      baselineSnapshot,
      ...recommendation,
    }),
  });
  return parseJsonResponse(response);
}

export async function captureValidationFollowUp(recordId, rep, derived) {
  const followUpSnapshot = {
    ...buildValidationSnapshot(rep, derived),
    capturedAt: new Date().toISOString(),
  };

  const response = await fetch(`/api/manager/validation/${encodeURIComponent(recordId)}/follow-up`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repId: rep.id, followUpSnapshot }),
  });
  return parseJsonResponse(response);
}
