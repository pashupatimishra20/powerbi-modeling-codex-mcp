import Ajv from "ajv";

import { readJson } from "./json.js";

const schemaCache = new Map();
let ajv = null;

function toGithubRawUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "developer.microsoft.com" || !parsed.pathname.startsWith("/json-schemas/")) {
      return null;
    }

    const schemaPath = parsed.pathname.replace(/^\/json-schemas\//, "");
    return `https://raw.githubusercontent.com/microsoft/json-schemas/main/${schemaPath}`;
  } catch {
    return null;
  }
}

async function fetchSchema(url) {
  if (schemaCache.has(url)) {
    return schemaCache.get(url);
  }

  const urlsToTry = [url];
  const githubRawUrl = toGithubRawUrl(url);
  if (githubRawUrl) {
    urlsToTry.push(githubRawUrl);
  }

  let lastError = null;
  for (const candidate of urlsToTry) {
    try {
      const response = await fetch(candidate, {
        headers: {
          "User-Agent": "powerbi-report-authoring-mcp"
        }
      });

      if (!response.ok) {
        lastError = new Error(
          `Schema fetch failed for ${candidate}: ${response.status} ${response.statusText}`
        );
        continue;
      }

      const schema = await response.json();
      schemaCache.set(url, schema);
      return schema;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`Schema fetch failed for ${url}`);
}

function getAjv() {
  if (!ajv) {
    ajv = new Ajv({
      strict: false,
      allErrors: true,
      loadSchema: fetchSchema
    });
  }

  return ajv;
}

export async function validateJsonFile(filePath) {
  const document = readJson(filePath);
  const schemaUrl = document.$schema;
  if (!schemaUrl) {
    return {
      filePath,
      valid: false,
      errors: [{ message: "Missing $schema property." }]
    };
  }

  const schema = await fetchSchema(schemaUrl);
  const validator = await getAjv().compileAsync(schema);
  const valid = validator(document);

  return {
    filePath,
    valid,
    errors: valid ? [] : validator.errors || []
  };
}

export async function validateJsonFiles(filePaths) {
  const results = [];
  for (const filePath of filePaths) {
    results.push(await validateJsonFile(filePath));
  }

  return results;
}

export function summarizeValidationResults(results) {
  return {
    valid: results.every((result) => result.valid),
    checkedFiles: results.length,
    invalidFiles: results
      .filter((result) => !result.valid)
      .map((result) => ({
        filePath: result.filePath,
        errors: result.errors.map((error) => ({
          instancePath: error.instancePath || "",
          message: error.message || "Unknown schema validation error"
        }))
      }))
  };
}
