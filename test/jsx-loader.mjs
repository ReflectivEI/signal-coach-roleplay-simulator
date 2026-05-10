import { readFile } from "node:fs/promises";

export async function resolve(specifier, context, defaultResolve) {
  const isRelativeNoExt = /^\.{1,2}\//.test(specifier) && !/\.[a-z]+$/i.test(specifier);

  if (isRelativeNoExt) {
    const attempts = [`${specifier}.js`, `${specifier}.jsx`, `${specifier}.mjs`];
    for (const candidate of attempts) {
      try {
        return await defaultResolve(candidate, context, defaultResolve);
      } catch {
        // try next extension
      }
    }
  }

  if (specifier.endsWith(".jsx")) {
    const resolved = await defaultResolve(specifier, context, defaultResolve);
    return {
      ...resolved,
      format: "module",
      shortCircuit: true,
    };
  }

  return defaultResolve(specifier, context, defaultResolve);
}

export async function load(url, context, defaultLoad) {
  if (url.endsWith(".jsx")) {
    const source = await readFile(new URL(url), "utf8");
    return {
      format: "module",
      source,
      shortCircuit: true,
    };
  }

  return defaultLoad(url, context, defaultLoad);
}
