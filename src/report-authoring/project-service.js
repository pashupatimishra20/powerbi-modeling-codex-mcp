import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DEFINITION_VERSION,
  DEFAULT_PAGE_SIZE,
  DEFAULT_REPORT,
  DEFAULT_VERSION_METADATA,
  SCHEMA_URLS
} from "./constants.js";
import { createPageName } from "./ids.js";
import { deepClone, readJson, writeJson } from "./json.js";
import {
  buildSemanticModelIndex,
  serializeSemanticModelIndex
} from "./semantic-model.js";
import {
  summarizeValidationResults,
  validateJsonFiles
} from "./schema-validator.js";

function ensureExists(value, message) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

export function toAbsoluteProjectRoot(projectPath) {
  const resolved = path.resolve(projectPath);
  if (resolved.toLowerCase().endsWith(".pbip")) {
    const pbip = readJson(resolved);
    const reportArtifact = pbip?.artifacts?.find((artifact) => artifact?.report?.path);
    ensureExists(reportArtifact, `PBIP file does not contain a report artifact: ${projectPath}`);
    const reportRoot = path.resolve(path.dirname(resolved), reportArtifact.report.path);
    ensureExists(
      fs.existsSync(path.join(reportRoot, "definition.pbir")),
      `PBIP report artifact does not resolve to a PBIR report root: ${reportRoot}`
    );
    return reportRoot;
  }

  if (resolved.toLowerCase().endsWith(".pbir")) {
    return path.dirname(resolved);
  }

  if (resolved.toLowerCase().endsWith(".report")) {
    return resolved;
  }

  if (fs.existsSync(path.join(resolved, "definition.pbir"))) {
    return resolved;
  }

  throw new Error(`Unsupported report project path: ${projectPath}`);
}

function inferSemanticModelRoot(projectRoot, definitionPbir) {
  const byPath = definitionPbir?.datasetReference?.byPath?.path;
  if (!byPath) {
    return null;
  }

  return path.resolve(projectRoot, byPath);
}

export function definitionPbirFile(project) {
  return path.join(project.root, "definition.pbir");
}

export function reportFile(project) {
  return path.join(project.definitionRoot, "report.json");
}

export function versionFile(project) {
  return path.join(project.definitionRoot, "version.json");
}

export function pageRoot(project) {
  return path.join(project.definitionRoot, "pages");
}

export function pagesMetadataFile(project) {
  return path.join(pageRoot(project), "pages.json");
}

export function pageDir(project, pageName) {
  return path.join(pageRoot(project), pageName);
}

export function pageFile(project, pageName) {
  return path.join(pageDir(project, pageName), "page.json");
}

export function pageVisualRoot(project, pageName) {
  return path.join(pageDir(project, pageName), "visuals");
}

export function visualDir(project, pageName, visualName) {
  return path.join(pageVisualRoot(project, pageName), visualName);
}

export function visualFile(project, pageName, visualName) {
  return path.join(visualDir(project, pageName, visualName), "visual.json");
}

function listSubdirectories(rootDir) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export function listPageNames(project) {
  return listSubdirectories(pageRoot(project)).filter((name) =>
    fs.existsSync(pageFile(project, name))
  );
}

export function listVisualNames(project, pageName) {
  return listSubdirectories(pageVisualRoot(project, pageName)).filter((name) =>
    fs.existsSync(visualFile(project, pageName, name))
  );
}

export function getPagesMetadata(project) {
  const filePath = pagesMetadataFile(project);
  if (!fs.existsSync(filePath)) {
    return {
      $schema: SCHEMA_URLS.pages,
      pageOrder: [],
      activePageName: null
    };
  }

  return readJson(filePath);
}

export function writePagesMetadata(project, pagesMetadata) {
  writeJson(pagesMetadataFile(project), pagesMetadata);
}

export function openProject(projectPath) {
  const root = toAbsoluteProjectRoot(projectPath);
  const definitionRoot = path.join(root, "definition");
  ensureExists(fs.existsSync(definitionRoot), `Missing definition folder under ${root}`);
  ensureExists(fs.existsSync(path.join(root, "definition.pbir")), `Missing definition.pbir under ${root}`);

  const definitionPbir = readJson(path.join(root, "definition.pbir"));
  const semanticModelRoot = inferSemanticModelRoot(root, definitionPbir);
  const semanticModel = semanticModelRoot
    ? buildSemanticModelIndex(semanticModelRoot)
    : { tables: new Map(), measures: new Map() };

  return {
    root,
    definitionRoot,
    definitionPbir,
    semanticModelRoot,
    semanticModel
  };
}

export function getProjectSummary(project) {
  const pagesMetadata = getPagesMetadata(project);
  const pages = listPageNames(project).map((pageName) => {
    const definition = readJson(pageFile(project, pageName));
    return {
      name: definition.name,
      displayName: definition.displayName,
      hidden: definition.visibility === "HiddenInViewMode",
      visualCount: listVisualNames(project, pageName).length
    };
  });

  return {
    projectRoot: project.root,
    reportDefinitionPath: definitionPbirFile(project),
    reportFilePath: reportFile(project),
    semanticModelRoot: project.semanticModelRoot,
    datasetReference: project.definitionPbir.datasetReference,
    activePageName: pagesMetadata.activePageName,
    pageCount: pages.length,
    pages,
    semanticModel: serializeSemanticModelIndex(project.semanticModel)
  };
}

function getProjectFilesForValidation(project) {
  const files = [
    definitionPbirFile(project),
    reportFile(project),
    versionFile(project),
    pagesMetadataFile(project)
  ].filter((filePath) => fs.existsSync(filePath));

  for (const pageName of listPageNames(project)) {
    files.push(pageFile(project, pageName));
    for (const visualName of listVisualNames(project, pageName)) {
      files.push(visualFile(project, pageName, visualName));
    }
  }

  return files;
}

export async function validateProject(project) {
  const results = await validateJsonFiles(getProjectFilesForValidation(project));
  return summarizeValidationResults(results);
}

export function listPages(project) {
  return listPageNames(project).map((pageName) => {
    const definition = readJson(pageFile(project, pageName));
    return {
      name: definition.name,
      displayName: definition.displayName,
      hidden: definition.visibility === "HiddenInViewMode",
      width: definition.width ?? null,
      height: definition.height ?? null
    };
  });
}

export function getPage(project, pageName) {
  const filePath = pageFile(project, pageName);
  ensureExists(fs.existsSync(filePath), `Page not found: ${pageName}`);
  return readJson(filePath);
}

export async function createPage(project, request) {
  const name = createPageName(request.pageName || request.displayName);
  const destinationDir = pageDir(project, name);
  ensureExists(!fs.existsSync(destinationDir), `Page already exists: ${name}`);

  let pageDefinition;
  if (request.duplicateFromPage) {
    const sourceDir = pageDir(project, request.duplicateFromPage);
    ensureExists(fs.existsSync(sourceDir), `Page to duplicate not found: ${request.duplicateFromPage}`);
    fs.cpSync(sourceDir, destinationDir, { recursive: true });
    pageDefinition = readJson(pageFile(project, name));
  } else {
    fs.mkdirSync(pageVisualRoot(project, name), { recursive: true });
    pageDefinition = {
      $schema: SCHEMA_URLS.page,
      name,
      displayName: request.displayName || name,
      displayOption: DEFAULT_PAGE_SIZE.displayOption,
      width: request.width ?? DEFAULT_PAGE_SIZE.width,
      height: request.height ?? DEFAULT_PAGE_SIZE.height
    };
  }

  pageDefinition.name = name;
  pageDefinition.displayName = request.displayName || pageDefinition.displayName || name;
  pageDefinition.width = request.width ?? pageDefinition.width ?? DEFAULT_PAGE_SIZE.width;
  pageDefinition.height = request.height ?? pageDefinition.height ?? DEFAULT_PAGE_SIZE.height;
  pageDefinition.displayOption = pageDefinition.displayOption ?? DEFAULT_PAGE_SIZE.displayOption;

  if (request.hidden != null) {
    pageDefinition.visibility = request.hidden ? "HiddenInViewMode" : "AlwaysVisible";
  }

  if (request.background) {
    pageDefinition.objects = pageDefinition.objects || {};
    pageDefinition.objects.background = [
      {
        properties: {
          color: {
            expr: {
              Literal: {
                Value: `'${String(request.background.color || request.background).replace(/'/g, "''")}'`
              }
            }
          }
        }
      }
    ];
  }

  if (request.tooltipTarget) {
    pageDefinition.pageBinding = {
      name: request.tooltipTarget
    };
  }

  writeJson(pageFile(project, name), pageDefinition);

  const pagesMetadata = getPagesMetadata(project);
  pagesMetadata.pageOrder = [...new Set([...(pagesMetadata.pageOrder || []), name])];
  if (request.active || !pagesMetadata.activePageName) {
    pagesMetadata.activePageName = name;
  }
  writePagesMetadata(project, pagesMetadata);

  const validation = summarizeValidationResults(
    await validateJsonFiles([pageFile(project, name), pagesMetadataFile(project)])
  );
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return getPage(project, name);
}

export async function updatePage(project, request) {
  const definition = getPage(project, request.pageName);
  if (request.displayName != null) {
    definition.displayName = request.displayName;
  }
  if (request.width != null) {
    definition.width = request.width;
  }
  if (request.height != null) {
    definition.height = request.height;
  }
  if (request.hidden != null) {
    definition.visibility = request.hidden ? "HiddenInViewMode" : "AlwaysVisible";
  }
  if (request.background) {
    definition.objects = definition.objects || {};
    definition.objects.background = [
      {
        properties: {
          color: {
            expr: {
              Literal: {
                Value: `'${String(request.background.color || request.background).replace(/'/g, "''")}'`
              }
            }
          }
        }
      }
    ];
  }
  if (request.tooltipTarget) {
    definition.pageBinding = { name: request.tooltipTarget };
  }

  writeJson(pageFile(project, request.pageName), definition);

  const pagesMetadata = getPagesMetadata(project);
  if (request.active) {
    pagesMetadata.activePageName = request.pageName;
    writePagesMetadata(project, pagesMetadata);
  }

  const files = [pageFile(project, request.pageName)];
  if (request.active) {
    files.push(pagesMetadataFile(project));
  }

  const validation = summarizeValidationResults(await validateJsonFiles(files));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return getPage(project, request.pageName);
}

export async function deletePage(project, request) {
  const targetDir = pageDir(project, request.pageName);
  ensureExists(fs.existsSync(targetDir), `Page not found: ${request.pageName}`);
  fs.rmSync(targetDir, { recursive: true, force: true });

  const pagesMetadata = getPagesMetadata(project);
  pagesMetadata.pageOrder = (pagesMetadata.pageOrder || []).filter((pageName) => pageName !== request.pageName);
  if (pagesMetadata.activePageName === request.pageName) {
    pagesMetadata.activePageName = pagesMetadata.pageOrder[0] ?? null;
  }
  writePagesMetadata(project, pagesMetadata);

  const validation = summarizeValidationResults(await validateJsonFiles([pagesMetadataFile(project)]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return {
    deletedPageName: request.pageName,
    remainingPages: listPages(project)
  };
}

export async function reorderPages(project, request) {
  const pageNames = new Set(listPageNames(project));
  for (const pageName of request.pageOrder || []) {
    ensureExists(pageNames.has(pageName), `Unknown page in pageOrder: ${pageName}`);
  }

  const pagesMetadata = getPagesMetadata(project);
  const remaining = [...pageNames].filter((pageName) => !(request.pageOrder || []).includes(pageName));
  pagesMetadata.pageOrder = [...(request.pageOrder || []), ...remaining];
  writePagesMetadata(project, pagesMetadata);

  const validation = summarizeValidationResults(await validateJsonFiles([pagesMetadataFile(project)]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return {
    pageOrder: pagesMetadata.pageOrder
  };
}

export async function duplicatePage(project, request) {
  return createPage(project, {
    ...request,
    duplicateFromPage: request.pageName,
    pageName: request.targetPageName,
    displayName: request.displayName
  });
}

export function createBlankProjectFixture(rootDir, semanticModelRelativePath) {
  fs.mkdirSync(path.join(rootDir, "definition", "pages", "ReportSection", "visuals"), {
    recursive: true
  });
  writeJson(path.join(rootDir, "definition.pbir"), {
    $schema: SCHEMA_URLS.definitionProperties,
    version: DEFAULT_DEFINITION_VERSION,
    datasetReference: {
      byPath: {
        path: semanticModelRelativePath
      }
    }
  });
  const project = { root: rootDir, definitionRoot: path.join(rootDir, "definition") };
  writeJson(reportFile(project), deepClone(DEFAULT_REPORT));
  writeJson(versionFile(project), deepClone(DEFAULT_VERSION_METADATA));
  writeJson(pageFile(project, "ReportSection"), {
    $schema: SCHEMA_URLS.page,
    name: "ReportSection",
    displayName: "Overview",
    displayOption: DEFAULT_PAGE_SIZE.displayOption,
    width: DEFAULT_PAGE_SIZE.width,
    height: DEFAULT_PAGE_SIZE.height
  });
  writeJson(pagesMetadataFile(project), {
    $schema: SCHEMA_URLS.pages,
    pageOrder: ["ReportSection"],
    activePageName: "ReportSection"
  });
}
