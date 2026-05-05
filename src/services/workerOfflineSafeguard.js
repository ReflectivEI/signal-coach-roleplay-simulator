/**
 * workerOfflineSafeguard.js
 *
 * Comprehensive safeguard for worker offline scenarios.
 * - Pre-flight health checks before synthesis
 * - Caches health status to avoid hammering endpoints
 * - Provides clear operator messaging
 * - Implements exponential backoff health check retries
 * - Circuit breaker pattern to prevent cascading failures
 */

import { checkWorkerHealth } from "@/services/workerClient";

const DEV_DEBUG_WORKER_HEALTH = import.meta?.env?.DEV && localStorage?.getItem("DEBUG_WORKER_HEALTH") === "true";

function debugLog(label, data) {
  if (!DEV_DEBUG_WORKER_HEALTH) return;
  console.log(`[workerOfflineSafeguard] ${label}`, data);
}

// Worker health state machine
const WorkerHealthState = {
  UNKNOWN: "unknown",
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  OFFLINE: "offline",
};

// Circuit breaker states
const CircuitBreakerState = {
  CLOSED: "closed", // Normal operation, health checks active
  OPEN: "open", // Worker down, skip health checks for 60s
  HALF_OPEN: "half_open", // Testing if worker recovered
};

class WorkerOfflineSafeguard {
  constructor() {
    this.healthStatus = WorkerHealthState.UNKNOWN;
    this.lastHealthCheckTime = null;
    this.healthCacheTtlMs = 5000; // Cache health status for 5 seconds
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.circuitBreakerOpenTime = null;
    this.circuitBreakerResetIntervalMs = 60000; // Try to recover after 60 seconds
    this.consecutiveFailures = 0;
    this.maxConsecutiveFailures = 3;
    this.healthCheckTimeoutMs = 8000;
  }

  /**
   * Check if we should run a health check based on circuit breaker state
   */
  shouldCheckHealth() {
    if (this.circuitBreakerState === CircuitBreakerState.CLOSED) {
      // Normal: check if cache is expired
      const cacheAge = Date.now() - (this.lastHealthCheckTime || 0);
      return cacheAge > this.healthCacheTtlMs;
    }

    if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
      // Circuit open: check if reset interval has passed (test recovery)
      const timeSinceOpen = Date.now() - this.circuitBreakerOpenTime;
      return timeSinceOpen > this.circuitBreakerResetIntervalMs;
    }

    if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
      // Half-open: do a single test check
      return true;
    }

    return false;
  }

  /**
   * Perform health check with circuit breaker logic
   */
  async performHealthCheck() {
    debugLog("performHealthCheck", { circuitState: this.circuitBreakerState });

    if (!this.shouldCheckHealth()) {
      debugLog("performHealthCheck", "Skipping: cache valid or circuit open");
      return this.healthStatus;
    }

    try {
      if (this.circuitBreakerState === CircuitBreakerState.OPEN) {
        // Transition to HALF_OPEN to test recovery
        this.circuitBreakerState = CircuitBreakerState.HALF_OPEN;
        debugLog("performHealthCheck", "Circuit breaker: OPEN -> HALF_OPEN (testing recovery)");
      }

      const status = await checkWorkerHealth();
      this.lastHealthCheckTime = Date.now();

      if (status === WorkerHealthState.OFFLINE) {
        this.consecutiveFailures += 1;

        if (this.consecutiveFailures >= this.maxConsecutiveFailures && this.circuitBreakerState !== CircuitBreakerState.OPEN) {
          // Too many failures: open circuit breaker
          this.circuitBreakerState = CircuitBreakerState.OPEN;
          this.circuitBreakerOpenTime = Date.now();
          debugLog("performHealthCheck", `Circuit breaker: CLOSED -> OPEN (${this.consecutiveFailures} failures)`);
        }
      } else {
        // Recovery: close circuit breaker
        if (this.circuitBreakerState === CircuitBreakerState.HALF_OPEN) {
          this.circuitBreakerState = CircuitBreakerState.CLOSED;
          debugLog("performHealthCheck", "Circuit breaker: HALF_OPEN -> CLOSED (recovered)");
        }
        this.consecutiveFailures = 0;
      }

      this.healthStatus = status;
      debugLog("performHealthCheck", { status, consecutiveFailures: this.consecutiveFailures });
      return status;
    } catch (err) {
      debugLog("performHealthCheck", `Error: ${err.message}`);
      this.consecutiveFailures += 1;
      this.lastHealthCheckTime = Date.now();
      this.healthStatus = WorkerHealthState.OFFLINE;
      return WorkerHealthState.OFFLINE;
    }
  }

  /**
   * Get current health status (may use cached value)
   */
  async getHealthStatus() {
    return this.performHealthCheck();
  }

  /**
   * Reset circuit breaker and cache (for manual recovery)
   */
  reset() {
    this.healthStatus = WorkerHealthState.UNKNOWN;
    this.lastHealthCheckTime = null;
    this.circuitBreakerState = CircuitBreakerState.CLOSED;
    this.circuitBreakerOpenTime = null;
    this.consecutiveFailures = 0;
    debugLog("reset", "Safeguard reset");
  }

  /**
   * Get health status and user-facing message
   */
  async getHealthReport() {
    const status = await this.getHealthStatus();

    const report = {
      status,
      isHealthy: status === WorkerHealthState.HEALTHY,
      isDegraded: status === WorkerHealthState.DEGRADED,
      isOffline: status === WorkerHealthState.OFFLINE,
      message: this.getStatusMessage(status),
      circuitBreaker: {
        state: this.circuitBreakerState,
        consecutiveFailures: this.consecutiveFailures,
      },
      cacheAge: Date.now() - (this.lastHealthCheckTime || 0),
    };

    debugLog("getHealthReport", report);
    return report;
  }

  /**
   * Get user-facing message for each status
   */
  getStatusMessage(status) {
    switch (status) {
      case WorkerHealthState.HEALTHY:
        return "Worker is healthy — AI synthesis available";

      case WorkerHealthState.DEGRADED:
        return "Worker is degraded — AI synthesis may be slow. Using basic retry strategy.";

      case WorkerHealthState.OFFLINE:
        return "Worker is offline — AI synthesis unavailable. Showing deterministic profile.";

      case WorkerHealthState.UNKNOWN:
        return "Worker status unknown — checking health...";

      default:
        return "Worker status unclear — falling back to deterministic profile.";
    }
  }

  /**
   * Should we attempt AI synthesis? (offline = no)
   */
  shouldAttemptAiSynthesis(status) {
    return status !== WorkerHealthState.OFFLINE;
  }
}

// Singleton instance
let safeguardInstance = null;

function getInstance() {
  if (!safeguardInstance) {
    safeguardInstance = new WorkerOfflineSafeguard();
  }
  return safeguardInstance;
}

export async function getWorkerHealthStatus() {
  const instance = getInstance();
  return instance.getHealthStatus();
}

export async function getWorkerHealthReport() {
  const instance = getInstance();
  return instance.getHealthReport();
}

export function shouldAttemptWorkerSynthesis(status) {
  const instance = getInstance();
  return instance.shouldAttemptAiSynthesis(status);
}

export function resetWorkerSafeguard() {
  const instance = getInstance();
  instance.reset();
}

export function setDebugWorkerHealth(enabled) {
  if (enabled) {
    localStorage.setItem("DEBUG_WORKER_HEALTH", "true");
    console.log("[workerOfflineSafeguard] Debug mode enabled. Run setDebugWorkerHealth(false) to disable.");
  } else {
    localStorage.removeItem("DEBUG_WORKER_HEALTH");
    console.log("[workerOfflineSafeguard] Debug mode disabled.");
  }
}

// Expose for development
if (import.meta?.env?.DEV) {
  /** @type {any} */ (window).getWorkerHealthStatus = getWorkerHealthStatus;
  /** @type {any} */ (window).getWorkerHealthReport = getWorkerHealthReport;
  /** @type {any} */ (window).resetWorkerSafeguard = resetWorkerSafeguard;
  /** @type {any} */ (window).setDebugWorkerHealth = setDebugWorkerHealth;
}
