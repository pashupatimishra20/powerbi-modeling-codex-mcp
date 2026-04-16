import fs from "node:fs";

import { getBookmark, listBookmarks } from "./bookmark-service.js";
import { getControlTemplate } from "./templates.js";
import { createVisualName } from "./ids.js";
import { deepClone, readJson, writeJson } from "./json.js";
import {
  booleanLiteral,
  ensureArrayObject,
  getAnnotation,
  quoteLiteral,
  setAnnotation
} from "./format-utils.js";
import { buildFieldExpressionFromRef } from "./query-utils.js";
import {
  getPage,
  listVisualNames,
  pageFile,
  refreshSemanticModel,
  visualDir,
  visualFile
} from "./project-service.js";
import {
  applyFormatting,
  getVisual,
  normalizeLayout,
  saveVisualDefinition,
  setTitle
} from "./visual-service.js";
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

function setVisualLink(definition, linkConfig = {}) {
  definition.visual.visualContainerObjects =
    definition.visual.visualContainerObjects || {};
  const linkProps = ensureArrayObject(definition.visual.visualContainerObjects, "visualLink");
  linkProps.show = booleanLiteral(true);

  for (const [key, value] of Object.entries(linkConfig)) {
    if (value == null) {
      delete linkProps[key];
      continue;
    }
    linkProps[key] = quoteLiteral(value);
  }
}

function normalizeFilterContext(value) {
  if (value === false || value === "None") {
    return "None";
  }
  return "Default";
}

function buildDrillthroughFilter(fieldRef, semanticModel, name, displayName) {
  const built = buildFieldExpressionFromRef(fieldRef, semanticModel, false);
  return {
    name,
    displayName,
    field: built.expression,
    type: "Include",
    howCreated: "Drillthrough",
    isHiddenInViewMode: true,
    isLockedInViewMode: true
  };
}

function buildDrillthroughParameter(fieldRef, semanticModel, name, boundFilter) {
  const built = buildFieldExpressionFromRef(fieldRef, semanticModel, false);
  return {
    name,
    boundFilter,
    fieldExpr: built.expression
  };
}

function createActionButtonDefinition(controlType, request) {
  const definition = getControlTemplate(controlType);
  definition.name = createVisualName(request.controlName || request.name);
  definition.position = normalizeLayout(request.layout, definition.position);
  if (request.visibility != null) {
    definition.isHidden = !request.visibility;
  }
  if (request.title) {
    setTitle(definition, request.title);
  }
  if (request.format) {
    applyFormatting(definition, request.format);
  }
  setAnnotation(definition, "codex.controlType", controlType);
  return definition;
}

function getNavigatorBookmarks(project, request) {
  const bookmarkSummaries = listBookmarks(project);
  if (request.groupName) {
    const filtered = bookmarkSummaries.filter((bookmark) => bookmark.groupName === request.groupName);
    ensureExists(filtered.length, `Bookmark group has no bookmarks: ${request.groupName}`);
    return filtered;
  }

  const standalone = bookmarkSummaries.filter((bookmark) => !bookmark.groupName);
  ensureExists(standalone.length, "No standalone bookmarks are available for navigator creation.");
  return standalone;
}

async function createBookmarkNavigator(project, request) {
  const controlName = request.controlName || request.name || `BookmarkNavigator_${Date.now()}`;
  const bookmarks = getNavigatorBookmarks(project, request);
  const createdVisuals = [];
  const spacing = request.spacing ?? 12;
  const orientation = request.orientation || "horizontal";
  const baseLayout = normalizeLayout(request.layout, {
    x: 0,
    y: 0,
    z: 0,
    width: 160,
    height: 40,
    tabOrder: 0
  });
  const bookmarkSequence = [...bookmarks];

  if (request.deselectionBookmarkName) {
    const deselectionBookmark = getBookmark(project, request.deselectionBookmarkName);
    bookmarkSequence.unshift({
      name: deselectionBookmark.name,
      displayName: deselectionBookmark.displayName,
      isDeselection: true
    });
  }

  for (const [index, bookmark] of bookmarkSequence.entries()) {
    const definition = createActionButtonDefinition("bookmarkNavigator", {
      ...request,
      controlName: `${controlName}_${index + 1}`,
      title: bookmark.displayName,
      layout: {
        ...baseLayout,
        x: orientation === "vertical" ? baseLayout.x : baseLayout.x + index * (baseLayout.width + spacing),
        y: orientation === "vertical" ? baseLayout.y + index * (baseLayout.height + spacing) : baseLayout.y,
        z: baseLayout.z + index,
        tabOrder: baseLayout.tabOrder + index
      }
    });

    setVisualLink(definition, {
      type: "Bookmark",
      bookmark: bookmark.name
    });
    setAnnotation(definition, "codex.navigatorName", controlName);
    setAnnotation(definition, "codex.navigatorBookmark", bookmark.name);
    if (request.groupName) {
      setAnnotation(definition, "codex.navigatorGroup", request.groupName);
    }
    if (bookmark.isDeselection) {
      setAnnotation(definition, "codex.navigatorDeselect", "true");
    }
    createdVisuals.push(await saveVisualDefinition(project, request.pageName, definition));
  }

  return {
    controlType: "bookmarkNavigator",
    controlName,
    visuals: createdVisuals
  };
}

function listNavigatorVisualNames(project, pageName, controlName) {
  return listVisualNames(project, pageName).filter((visualName) => {
    const definition = readJson(visualFile(project, pageName, visualName));
    return getAnnotation(definition, "codex.navigatorName") === controlName;
  });
}

async function updateBookmarkNavigator(project, request) {
  const visualNames = listNavigatorVisualNames(project, request.pageName, request.controlName);
  ensureExists(visualNames.length, `Bookmark navigator not found: ${request.pageName}/${request.controlName}`);

  const firstDefinition = readJson(visualFile(project, request.pageName, visualNames[0]));
  const fallbackLayout = firstDefinition.position;
  for (const visualName of visualNames) {
    fs.rmSync(visualDir(project, request.pageName, visualName), { recursive: true, force: true });
  }

  return createBookmarkNavigator(project, {
    ...request,
    layout: request.layout || fallbackLayout
  });
}

export async function configureDrillthroughPage(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.fieldRefs?.length, "fieldRefs are required for drillthrough configuration.");
  refreshSemanticModel(project);

  const definition = getPage(project, request.pageName);
  const filterConfig = deepClone(definition.filterConfig || { filters: [] });
  const filterNamesToRemove = new Set((definition.pageBinding?.parameters || []).map((parameter) => parameter.boundFilter));
  filterConfig.filters = (filterConfig.filters || []).filter((filter) => !filterNamesToRemove.has(filter.name));

  const parameters = [];
  for (const [index, fieldRef] of request.fieldRefs.entries()) {
    const filterName = `${request.pageName}_DrillthroughFilter_${index + 1}`;
    const parameterName = `DrillthroughParam_${index + 1}`;
    filterConfig.filters.push(
      buildDrillthroughFilter(fieldRef, project.semanticModel, filterName, request.fieldDisplayNames?.[index])
    );
    parameters.push(
      buildDrillthroughParameter(fieldRef, project.semanticModel, parameterName, filterName)
    );
  }

  definition.filterConfig = filterConfig;
  definition.pageBinding = {
    name: request.bindingName || `${request.pageName}_Drillthrough`,
    type: "Drillthrough",
    referenceScope: "Default",
    acceptsFilterContext: normalizeFilterContext(request.acceptsFilterContext),
    parameters
  };

  if (request.hidden !== false) {
    definition.visibility = "HiddenInViewMode";
  }

  writeJson(pageFile(project, request.pageName), definition);

  let backButton = null;
  if (request.autoCreateBackButton !== false) {
    backButton = await createControl(project, {
      pageName: request.pageName,
      controlType: "backButton",
      controlName: `${request.pageName}_Back`,
      title: request.backButtonTitle || "Back",
      layout: request.backButtonLayout || {
        x: 16,
        y: 16,
        width: 120,
        height: 36,
        z: 9999,
        tabOrder: 9999
      },
      format: request.backButtonFormat
    });
  }

  const validation = summarizeValidationResults(await validateJsonFiles([pageFile(project, request.pageName)]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return {
    page: getPage(project, request.pageName),
    backButton
  };
}

export async function clearDrillthroughPage(project, request) {
  const definition = getPage(project, request.pageName);
  const boundFilters = new Set((definition.pageBinding?.parameters || []).map((parameter) => parameter.boundFilter));
  if (definition.filterConfig?.filters?.length) {
    definition.filterConfig.filters = definition.filterConfig.filters.filter(
      (filter) => !boundFilters.has(filter.name)
    );
    if (!definition.filterConfig.filters.length) {
      delete definition.filterConfig;
    }
  }
  delete definition.pageBinding;
  writeJson(pageFile(project, request.pageName), definition);

  for (const visualName of listVisualNames(project, request.pageName)) {
    const visualDefinition = readJson(visualFile(project, request.pageName, visualName));
    if (
      getAnnotation(visualDefinition, "codex.controlType") === "backButton" &&
      getAnnotation(visualDefinition, "codex.drillthroughPage") === request.pageName
    ) {
      fs.rmSync(visualDir(project, request.pageName, visualName), { recursive: true, force: true });
    }
  }

  const validation = summarizeValidationResults(await validateJsonFiles([pageFile(project, request.pageName)]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return getPage(project, request.pageName);
}

export async function setSlicerSync(project, request) {
  const definition = getVisual(project, request.pageName, request.visualName);
  ensureExists(definition.visual?.visualType === "slicer", "Slicer sync only applies to slicer visuals.");

  const projectionCount =
    definition.visual?.query?.queryState?.Values?.projections?.length || 0;
  ensureExists(
    projectionCount <= 1,
    "Sync slicers only supports slicers with a single bound field."
  );

  if (!request.groupName) {
    delete definition.visual.syncGroup;
  } else {
    definition.visual.syncGroup = {
      groupName: request.groupName,
      fieldChanges: request.syncFieldChanges ?? false,
      filterChanges: request.syncFilterChanges ?? true
    };
  }

  return saveVisualDefinition(project, request.pageName, definition);
}

export async function createControl(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.controlType, "controlType is required.");

  if (request.controlType === "bookmarkNavigator") {
    return createBookmarkNavigator(project, request);
  }

  const definition = createActionButtonDefinition(request.controlType, request);
  switch (request.controlType) {
    case "backButton":
      setVisualLink(definition, {
        type: "Back"
      });
      setAnnotation(definition, "codex.drillthroughPage", request.pageName);
      break;
    case "bookmarkButton":
      ensureExists(request.bookmarkName, "bookmarkName is required for bookmark buttons.");
      getBookmark(project, request.bookmarkName);
      setVisualLink(definition, {
        type: "Bookmark",
        bookmark: request.bookmarkName
      });
      setAnnotation(definition, "codex.bookmarkName", request.bookmarkName);
      break;
    case "drillthroughButton":
      ensureExists(request.drillthroughPageName, "drillthroughPageName is required for drillthrough buttons.");
      {
        const drillthroughPage = getPage(project, request.drillthroughPageName);
        ensureExists(
          drillthroughPage.pageBinding?.type === "Drillthrough",
          `Target page is not configured for drillthrough: ${request.drillthroughPageName}`
        );
      }
      setVisualLink(definition, {
        type: "Drillthrough",
        drillthroughSection: request.drillthroughPageName
      });
      setAnnotation(definition, "codex.drillthroughTarget", request.drillthroughPageName);
      break;
    default:
      throw new Error(`Unsupported control type: ${request.controlType}`);
  }

  return saveVisualDefinition(project, request.pageName, definition);
}

export async function updateControl(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.controlName, "controlName is required.");

  if (request.controlType === "bookmarkNavigator") {
    return updateBookmarkNavigator(project, request);
  }

  const definition = getVisual(project, request.pageName, request.controlName);
  ensureExists(
    getAnnotation(definition, "codex.controlType"),
    `Visual is not a managed interactive control: ${request.pageName}/${request.controlName}`
  );

  definition.position = request.layout
    ? normalizeLayout(request.layout, definition.position)
    : definition.position;
  if (request.title != null) {
    setTitle(definition, request.title);
  }
  if (request.format) {
    applyFormatting(definition, request.format);
  }

  const controlType = request.controlType || getAnnotation(definition, "codex.controlType");
  switch (controlType) {
    case "backButton":
      setVisualLink(definition, { type: "Back" });
      break;
    case "bookmarkButton":
      ensureExists(request.bookmarkName, "bookmarkName is required for bookmark buttons.");
      getBookmark(project, request.bookmarkName);
      setVisualLink(definition, {
        type: "Bookmark",
        bookmark: request.bookmarkName
      });
      setAnnotation(definition, "codex.bookmarkName", request.bookmarkName);
      break;
    case "drillthroughButton":
      ensureExists(request.drillthroughPageName, "drillthroughPageName is required for drillthrough buttons.");
      setVisualLink(definition, {
        type: "Drillthrough",
        drillthroughSection: request.drillthroughPageName
      });
      setAnnotation(definition, "codex.drillthroughTarget", request.drillthroughPageName);
      break;
    default:
      throw new Error(`Unsupported control type: ${controlType}`);
  }

  return saveVisualDefinition(project, request.pageName, definition);
}
