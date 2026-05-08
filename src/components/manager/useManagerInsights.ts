import { useEffect, useMemo, useState } from "react";
import { managerInsightsRequestSchema } from "./managerInsightsShared";
import type { ManagerInsightsRequest } from "./managerInsightsTypes";

type NormalizeResult<T> = (payload: unknown) => T | null;

type HookState<T> = {
  data: T | null;
  loading: boolean;
  unavailable: boolean;
};

const inflightRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, unknown>();

function loadManagerInsights(requestSignature: string) {
  if (responseCache.has(requestSignature)) {
    return Promise.resolve(responseCache.get(requestSignature));
  }

  const existingRequest = inflightRequests.get(requestSignature);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetch("/manager-insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestSignature,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`manager_insights_${response.status}`);
      }
      return response.json();
    })
    .then((payload) => {
      responseCache.set(requestSignature, payload);
      inflightRequests.delete(requestSignature);
      return payload;
    })
    .catch((error) => {
      inflightRequests.delete(requestSignature);
      throw error;
    });

  inflightRequests.set(requestSignature, request);
  return request;
}

export function useManagerInsights<T>(analyticsData: ManagerInsightsRequest, normalizeResult: NormalizeResult<T>): HookState<T> & {
  requestBody: ManagerInsightsRequest | null;
  requestSignature: string;
} {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const requestBody = useMemo(() => {
    const parsed = managerInsightsRequestSchema.safeParse(analyticsData);
    return parsed.success ? (parsed.data as ManagerInsightsRequest) : null;
  }, [analyticsData]);

  const requestSignature = useMemo(() => (requestBody ? JSON.stringify(requestBody) : ""), [requestBody]);

  useEffect(() => {
    if (!requestBody || !requestSignature) {
      setData(null);
      setLoading(false);
      setUnavailable(false);
      return;
    }

    const cachedPayload = responseCache.get(requestSignature);
    if (cachedPayload !== undefined) {
      const normalizedPayload = normalizeResult(cachedPayload);
      setData(normalizedPayload);
      setLoading(false);
      setUnavailable(!normalizedPayload);
      return;
    }

    let active = true;
    setLoading(true);
    setUnavailable(false);

    loadManagerInsights(requestSignature)
      .then((payload) => {
        if (!active) {
          return;
        }
        const normalizedPayload = normalizeResult(payload);
        setData(normalizedPayload);
        setUnavailable(!normalizedPayload);
      })
      .catch((error: Error) => {
        if (!active) {
          return;
        }
        console.error("Manager insights unavailable:", error);
        setData(null);
        setUnavailable(true);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [normalizeResult, requestBody, requestSignature]);

  return {
    data,
    loading,
    unavailable,
    requestBody,
    requestSignature,
  };
}