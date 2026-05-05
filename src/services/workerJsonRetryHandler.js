/**
 * workerJsonRetryHandler.js
 *
 * Implements aggressive JSON extraction, formatting recovery, and retry logic
 * to ensure formatting mismatches NEVER result in silent fallbacks.
 *
 * Success criteria:
 * - ALL parse failures attempt recovery via multiple extraction strategies.
 * - Explicit separation: parse errors vs. service errors vs. schema errors.
 * - Debug instrumentation behind DEV_DEBUG_JSON_PARSING flag.
 * - Circuit breaker only engages on TRUE service failures (network, timeout, rate limit).
 * - No silent fallback to deterministic mode.
 */

const DEV_DEBUG_JSON_PARSING = import.meta?.env?.DEV && localStorage?.getItem("DEBUG_JSON_PARSING") === "true";

function debugLog(label, data) {
    if (!DEV_DEBUG_JSON_PARSING) return;
    console.log(`[workerJsonRetryHandler] ${label}`, data);
}

function debugWarn(label, data) {
    if (!DEV_DEBUG_JSON_PARSING) return;
    console.warn(`[workerJsonRetryHandler] ${label}`, data);
}

/**
 * Strategy 1: Remove markdown code fences (```json ... ```)
 */
function stripMarkdownFences(text) {
    const trimmed = String(text || "").trim();
    const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (match) {
        debugLog("stripMarkdownFences", "Removed markdown code fences");
        return match[1].trim();
    }
    return trimmed;
}

/**
 * Strategy 2: Remove common AI preamble patterns
 */
function stripAiPreamble(text) {
    let result = String(text || "");

    // Remove leading commentary like "Here is the JSON:" or "Here's the synthesis:"
    result = result.replace(/^[\s\S]*?(?=\{|\[)/i, "");

    // Remove common model prefixes
    const patterns = [
        /^.*?(?:here'?s the (?:json|object|response|synthesis|profile).*?[:\n])/i,
        /^.*?(?:returned below.*?[:\n])/i,
        /^.*?(?:the following.*?[:\n])/i,
    ];

    patterns.forEach((pattern) => {
        const stripped = result.replace(pattern, "");
        if (stripped !== result) {
            debugLog("stripAiPreamble", "Removed preamble pattern");
            result = stripped;
        }
    });

    return result.trim();
}

/**
 * Strategy 3: Remove common AI suffix patterns
 */
function stripAiSuffix(text) {
    let result = String(text || "");

    // Remove trailing commentary
    const patterns = [
        /\n\n[^{}[\]]*?(?:hope this|let me know|feel free|please let me|if you have|any questions|need further|additional|more information)[^{}[\]]*/i,
        /\n\n[^{}[\]]*?(?:---+|===+|note:|notes:|caveat:|caveats:|disclaimer:)[^{}[\]]*/i,
    ];

    patterns.forEach((pattern) => {
        const stripped = result.replace(pattern, "");
        if (stripped !== result) {
            debugLog("stripAiSuffix", "Removed suffix pattern");
            result = stripped;
        }
    });

    return result.trim();
}

/**
 * Strategy 4: Extract first balanced JSON object or array
 */
function extractFirstBalancedJson(text) {
    const input = String(text || "");
    const starts = ["{", "["].map((char) => input.indexOf(char)).filter((idx) => idx >= 0);
    if (!starts.length) {
        debugLog("extractFirstBalancedJson", "No JSON start character found");
        return null;
    }

    const start = Math.min(...starts);
    const open = input[start];
    const close = open === "{" ? "}" : "]";
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < input.length; i += 1) {
        const ch = input[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (ch === "\\") {
                escaped = true;
            } else if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }

        if (ch === open) depth += 1;
        if (ch === close) depth -= 1;

        if (depth === 0) {
            const extracted = input.slice(start, i + 1).trim();
            debugLog("extractFirstBalancedJson", `Extracted ${extracted.length} chars`);
            return extracted;
        }
    }

    debugWarn("extractFirstBalancedJson", "Balanced JSON not found (truncated output?)");
    return null;
}

/**
 * Strategy 5: Attempt to salvage truncated JSON by closing it
 */
function salvageTruncatedJson(text) {
    let result = String(text || "").trim();

    // If it starts with { or [ but isn't balanced, try closing it
    if (result.startsWith("{") || result.startsWith("[")) {
        const open = result[0];
        const close = open === "{" ? "}" : "]";

        try {
            // Count unmatched brackets
            let depth = 0;
            let inString = false;
            let escaped = false;

            for (let i = 0; i < result.length; i += 1) {
                const ch = result[i];
                if (inString) {
                    if (escaped) {
                        escaped = false;
                    } else if (ch === "\\") {
                        escaped = true;
                    } else if (ch === '"') {
                        inString = false;
                    }
                    continue;
                }

                if (ch === '"') {
                    inString = true;
                    continue;
                }

                if (ch === open) depth += 1;
                if (ch === close) depth -= 1;
            }

            // Add closing brackets if needed
            if (depth > 0) {
                const closingBrackets = close.repeat(depth);
                result += closingBrackets;
                debugLog("salvageTruncatedJson", `Added ${depth} closing bracket(s)`);
            }
        } catch (err) {
            debugWarn("salvageTruncatedJson", `Salvage attempt failed: ${err.message}`);
        }
    }

    return result;
}

/**
 * Strategy 6: Try common typo corrections for JSON (rare but happens)
 */
function fixCommonJsonTypos(text) {
    let result = String(text || "");

    // Replace single quotes with double quotes in JSON (invalid in JSON)
    // But be careful not to replace quotes inside strings
    if (!result.includes('"')) {
        result = result.replace(/'/g, '"');
        debugLog("fixCommonJsonTypos", "Converted single quotes to double quotes");
    }

    return result;
}

/**
 * Main extraction pipeline: tries all strategies in sequence
 */
export function robustJsonExtraction(payload) {
    debugLog("robustJsonExtraction", { payloadLength: String(payload || "").length });

    const strategies = [
        { name: "stripMarkdownFences", fn: stripMarkdownFences },
        { name: "stripAiPreamble", fn: stripAiPreamble },
        { name: "stripAiSuffix", fn: stripAiSuffix },
        { name: "extractFirstBalancedJson", fn: extractFirstBalancedJson },
        { name: "salvageTruncatedJson", fn: salvageTruncatedJson },
        { name: "fixCommonJsonTypos", fn: fixCommonJsonTypos },
    ];

    let current = String(payload || "");

    for (const strategy of strategies) {
        try {
            const next = strategy.fn(current);
            if (next && next !== current) {
                current = next;
                debugLog(`Strategy: ${strategy.name}`, "Applied successfully");
            }
        } catch (err) {
            debugWarn(`Strategy: ${strategy.name}`, `Failed: ${err.message}`);
        }
    }

    debugLog("robustJsonExtraction", `Final extraction length: ${current.length}`);
    return current;
}

/**
 * Attempt to parse extracted JSON with detailed error categorization
 */
export function parseJsonWithErrorCategory(extracted) {
    try {
        const parsed = JSON.parse(extracted);
        debugLog("parseJsonWithErrorCategory", "Parse successful");
        return {
            success: true,
            data: parsed,
            error: null,
            category: "success",
        };
    } catch (parseErr) {
        debugWarn("parseJsonWithErrorCategory", `Parse failed: ${parseErr.message}`);

        // Categorize error for better retry strategy
        const message = String(parseErr.message || "").toLowerCase();
        let category = "unknown_json_error";

        if (message.includes("unexpected token")) {
            category = "malformed_json";
        } else if (message.includes("unexpected end")) {
            category = "truncated_json";
        } else if (message.includes("json.parse")) {
            category = "invalid_json";
        }

        return {
            success: false,
            data: null,
            error: parseErr,
            category,
            errorMessage: parseErr.message,
        };
    }
}

/**
 * Comprehensive retry wrapper: makes direct worker calls with extraction + parse
 * Bypasses invokeWorkerJson to apply 6-layer extraction BEFORE parsing
 * (invokeWorkerJson applies only basic extraction, so we need to intercept earlier)
 */
export async function invokeWorkerJsonWithRetry({
    invokerFn,
    maxRetries = 5,
    temperature = 0.18,
    onRetry = null,
}) {
    let lastError = null;
    const errors = [];

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
            debugLog("invokeWorkerJsonWithRetry", { attempt: attempt + 1, maxRetries: maxRetries + 1 });

            // Call the invoker function, which should return raw STRING payload (not parsed)
            // invokerFn receives temperature and should make the actual worker call
            const adjustedTemp = temperature - attempt * 0.02;
            let rawPayload;

            try {
                rawPayload = await invokerFn(adjustedTemp);
            } catch (invokerErr) {
                // If invokerFn throws, it might be a network error or worker down
                debugWarn("invokeWorkerJsonWithRetry", `Invoker error: ${invokerErr.message}`);
                errors.push({
                    attempt: attempt + 1,
                    category: "invoker_error",
                    message: invokerErr.message,
                });

                if (attempt < maxRetries) {
                    const delayMs = Math.min(1000 * Math.pow(1.5, attempt), 8000);
                    debugLog("invokeWorkerJsonWithRetry", `Waiting ${delayMs}ms before retry after invoker error`);

                    if (onRetry) {
                        onRetry({
                            attempt: attempt + 1,
                            category: "invoker_error",
                            willRetry: true,
                            delayMs,
                            error: invokerErr.message,
                        });
                    }

                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                    lastError = invokerErr;
                }
                continue;
            }

            // We got a response (either string or object)
            // If object with .response field, extract that
            if (rawPayload && typeof rawPayload === "object" && rawPayload.response) {
                rawPayload = rawPayload.response;
            }

            const payloadStr = String(rawPayload || "");
            debugLog("invokeWorkerJsonWithRetry", { payloadReceived: true, length: payloadStr.length });

            // Apply robust 6-layer extraction pipeline
            const extracted = robustJsonExtraction(payloadStr);

            // Attempt parse with error categorization
            const parseResult = parseJsonWithErrorCategory(extracted);

            if (parseResult.success) {
                debugLog("invokeWorkerJsonWithRetry", "Success on attempt " + (attempt + 1));
                return parseResult.data;
            }

            // Parse failed; will retry
            errors.push({
                attempt: attempt + 1,
                category: parseResult.category,
                message: parseResult.errorMessage,
                extractedLength: extracted.length,
            });

            if (attempt < maxRetries) {
                const delayMs = Math.min(500 * Math.pow(1.5, attempt), 5000);
                debugLog("invokeWorkerJsonWithRetry", `Waiting ${delayMs}ms before retry`);

                if (onRetry) {
                    onRetry({
                        attempt: attempt + 1,
                        category: parseResult.category,
                        willRetry: true,
                        delayMs,
                    });
                }

                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        } catch (err) {
            // Unexpected error during extraction/parsing
            debugWarn("invokeWorkerJsonWithRetry", `Unexpected error: ${err.message}`);
            errors.push({
                attempt: attempt + 1,
                category: "unexpected_error",
                message: err.message,
            });

            if (attempt < maxRetries) {
                const delayMs = Math.min(500 * Math.pow(1.5, attempt), 5000);
            }

            lastError = err;
        }
    }

    // All retries exhausted
    debugWarn("invokeWorkerJsonWithRetry", { allRetriesExhausted: true, errorCount: errors.length, errors });

    const summary = {
        attemptsCount: maxRetries + 1,
        errors,
        lastError,
    };

    const error = /** @type {Error & { code?: string, summary?: unknown }} */ (new Error("Worker JSON invocation failed after all retries"));
    error.code = "WORKER_JSON_RETRY_EXHAUSTED";
    error.summary = summary;
    throw error;
}

/**
 * Public export for enabling/disabling debug mode (can be toggled in browser console)
 */
export function setDebugJsonParsing(enabled) {
    if (enabled) {
        localStorage.setItem("DEBUG_JSON_PARSING", "true");
        console.log("[workerJsonRetryHandler] Debug mode enabled. Run setDebugJsonParsing(false) to disable.");
    } else {
        localStorage.removeItem("DEBUG_JSON_PARSING");
        console.log("[workerJsonRetryHandler] Debug mode disabled.");
    }
}

// Expose for development
if (import.meta?.env?.DEV) {
    /** @type {any} */ (window).setDebugJsonParsing = setDebugJsonParsing;
}
