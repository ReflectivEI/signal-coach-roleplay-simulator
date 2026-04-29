import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_WORKER_NAME = "reflectivai-rps-api";

type IdentityReport = {
    pass: boolean;
    failures: string[];
    wranglerName: string;
    workerHealthService: string;
    details: {
        wranglerTomlExists: boolean;
        workerSourceExists: boolean;
    };
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const WRANGLER_TOML_PATH = path.resolve(REPO_ROOT, "wrangler.toml");
const WORKER_SOURCE_PATH = path.resolve(REPO_ROOT, "worker/src/index.js");

async function readIfExists(filePath: string) {
    try {
        const content = await fs.readFile(filePath, "utf8");
        return { exists: true, content };
    } catch {
        return { exists: false, content: "" };
    }
}

function extractTomlName(tomlContent: string) {
    const match = tomlContent.match(/^\s*name\s*=\s*"([^"]+)"\s*$/m);
    return match?.[1] || "";
}

function extractWorkerHealthService(workerSource: string) {
    const match = workerSource.match(/\bservice\s*:\s*"([^"]+)"/);
    return match?.[1] || "";
}

export async function verifyRpsIdentity(): Promise<IdentityReport> {
    const failures: string[] = [];

    const wrangler = await readIfExists(WRANGLER_TOML_PATH);
    const workerSource = await readIfExists(WORKER_SOURCE_PATH);

    const wranglerName = wrangler.exists ? extractTomlName(wrangler.content) : "";
    const workerHealthService = workerSource.exists ? extractWorkerHealthService(workerSource.content) : "";

    if (!wrangler.exists) {
        failures.push("missing wrangler.toml");
    }
    if (!workerSource.exists) {
        failures.push("missing worker/src/index.js");
    }
    if (wrangler.exists && !wranglerName) {
        failures.push("wrangler.toml missing worker name");
    }
    if (workerSource.exists && !workerHealthService) {
        failures.push("worker health service name not found");
    }
    if (wranglerName && wranglerName !== EXPECTED_WORKER_NAME) {
        failures.push(`wrangler worker name mismatch: ${wranglerName}`);
    }
    if (workerHealthService && workerHealthService !== EXPECTED_WORKER_NAME) {
        failures.push(`worker health service mismatch: ${workerHealthService}`);
    }

    return {
        pass: failures.length === 0,
        failures,
        wranglerName,
        workerHealthService,
        details: {
            wranglerTomlExists: wrangler.exists,
            workerSourceExists: workerSource.exists,
        },
    };
}
