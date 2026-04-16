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
  getPagesMetadata,
  getReportDefinition,
  listPageNames,
  listVisualNames,
  pageFile,
  refreshSemanticModel,
  reportFile,
  visualDir,
  visualFile,
  writeReportDefinition
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

function getStoredControlType(definition) {
  return getAnnotation(definition, "codex.controlType");
}

function setVisualLink(definition, linkConfig = {}) {
  definition.visual.visualContainerObjects =
    definition.visual.visualContainerObjects || {};
  const linkProps = ensureArrayObject(definition.visual.visualContainerObjects, "visualLink");
  linkProps.show = booleanLiteral(true);

  const knownKeys = [
    "type",
    "bookmark",
    "drillthroughSection",
    "navigationSection",
    "qna",
    "webUrl",
    "disabledTooltip",
    "enabledTooltip",
    "tooltip"
  ];
  for (const key of knownKeys) {
    if (!(key in linkConfig)) {
      delete linkProps[key];
    }
  }

  for (const [key, value] of Object.entries(linkConfig)) {
    if (value == null) {
      delete linkProps[key];
      continue;
    }
    linkProps[key] = quoteLiteral(value);
  }
}

function setVisualTooltip(definition, tooltipPageName) {
  definition.visual.visualContainerObjects =
    definition.visual.visualContainerObjects || {};
  if (!tooltipPageName) {
    delete definition.visual.visualContainerObjects.visualTooltip;
    return;
  }

  const tooltipProps = ensureArrayObject(
    definition.visual.visualContainerObjects,
    "visualTooltip"
  );
  tooltipProps.show = booleanLiteral(true);
  tooltipProps.type = quoteLiteral("ReportPage");
  tooltipProps.section = quoteLiteral(tooltipPageName);
}

function normalizeFilterContext(value) {
  if (value === false || value === "None") {
    return "None";
  }
  return "Default";
}

function normalizeInteractionType(value) {
  switch (String(value || "Default")) {
    case "filter":
    case "DataFilter":
      return "DataFilter";
    case "highlight":
    case "HighlightFilter":
      return "HighlightFilter";
    case "none":
    case "NoFilter":
      return "NoFilter";
    default:
      return "Default";
  }
}

function buildPageBindingFilter(fieldRef, semanticModel, name, displayName, howCreated) {
  const built = buildFieldExpressionFromRef(fieldRef, semanticModel, false);
  return {
    name,
    displayName,
    field: built.expression,
    type: "Include",
    howCreated,
    isHiddenInViewMode: true,
    isLockedInViewMode: true
  };
}

function buildPageBindingParameter(fieldRef, semanticModel, name, boundFilter) {
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

function buildGeneratedNavigatorLayout(baseLayout, index, orientation, spacing) {
  return {
    ...baseLayout,
    x: orientation === "vertical" ? baseLayout.x : baseLayout.x + index * (baseLayout.width + spacing),
    y: orientation === "vertical" ? baseLayout.y + index * (baseLayout.height + spacing) : baseLayout.y,
    z: baseLayout.z + index,
    tabOrder: baseLayout.tabOrder + index
  };
}

function listNavigatorVisualNames(project, pageName, controlName, controlType = null) {
  return listVisualNames(project, pageName).filter((visualName) => {
    const definition = readJson(visualFile(project, pageName, visualName));
    return (
      getAnnotation(definition, "codex.navigatorName") === controlName &&
      (!controlType || getStoredControlType(definition) === controlType)
    );
  });
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

function getNavigatorPages(project, request) {
  const pageLookup = new Map(
    listPageNames(project).map((pageName) => {
      const page = getPage(project, pageName);
      return [
        pageName,
        {
          name: page.name,
          displayName: page.displayName,
          hidden: page.visibility === "HiddenInViewMode",
          isTooltipPage: page.pageBinding?.type === "Tooltip"
        }
      ];
    })
  );
  const pagesMetadata = getPagesMetadata(project);
  const orderedNames = [
    ...(pagesMetadata.pageOrder || []).filter((pageName) => pageLookup.has(pageName)),
    ...[...pageLookup.keys()].filter((pageName) => !(pagesMetadata.pageOrder || []).includes(pageName))
  ];
  const pages = orderedNames.map((pageName) => pageLookup.get(pageName));

  return pages.filter((page) => {
    if (page.hidden && !request.showHiddenPages) {
      return false;
    }
    if (page.isTooltipPage && !request.showTooltipPages) {
      return false;
    }
    return true;
  });
}

async function createGeneratedNavigator(project, request, config) {
  const controlName = request.controlName || request.name || `${config.controlType}_${Date.now()}`;
  const orientation = request.orientation || "horizontal";
  const spacing = request.spacing ?? 12;
  const baseLayout = normalizeLayout(request.layout, {
    x: 0,
    y: 0,
    z: 0,
    width: 160,
    height: 40,
    tabOrder: 0
  });
  const items = config.getItems(project, request);
  ensureExists(items.length, `${config.controlType} has no items to create.`);

  const createdVisuals = [];
  for (const [index, item] of items.entries()) {
    const definition = createActionButtonDefinition(config.templateType, {
      ...request,
      controlName: `${controlName}_${index + 1}`,
      title: item.displayName,
      layout: buildGeneratedNavigatorLayout(baseLayout, index, orientation, spacing)
    });

    config.applyLink(project, request, definition, item);
    setAnnotation(definition, "codex.controlType", config.controlType);
    setAnnotation(definition, "codex.navigatorName", controlName);
    setAnnotation(definition, "codex.navigatorItem", item.name);
    setAnnotation(definition, "codex.navigatorOrientation", orientation);
    setAnnotation(definition, "codex.navigatorSpacing", spacing);

    if (request.groupName) {
      setAnnotation(definition, "codex.navigatorGroup", request.groupName);
    }
    if (request.showHiddenPages != null) {
      setAnnotation(definition, "codex.navigatorShowHidden", request.showHiddenPages);
    }
    if (request.showTooltipPages != null) {
      setAnnotation(definition, "codex.navigatorShowTooltip", request.showTooltipPages);
    }
    if (item.isDeselection) {
      setAnnotation(definition, "codex.navigatorDeselect", "true");
    }

    createdVisuals.push(await saveVisualDefinition(project, request.pageName, definition));
  }

  await refreshApplyAllSlicersSetting(project);
  return {
    controlType: config.controlType,
    controlName,
    visuals: createdVisuals
  };
}

async function createBookmarkNavigator(project, request) {
  const bookmarks = getNavigatorBookmarks(project, request);
  const bookmarkSequence = [...bookmarks];

  if (request.deselectionBookmarkName) {
    const deselectionBookmark = getBookmark(project, request.deselectionBookmarkName);
    bookmarkSequence.unshift({
      name: deselectionBookmark.name,
      displayName: deselectionBookmark.displayName,
      isDeselection: true
    });
  }

  return createGeneratedNavigator(project, { ...request }, {
    controlType: "bookmarkNavigator",
    templateType: "bookmarkNavigator",
    getItems: () => bookmarkSequence,
    applyLink: (_project, _request, definition, item) => {
      setVisualLink(definition, {
        type: "Bookmark",
        bookmark: item.name
      });
      setAnnotation(definition, "codex.navigatorBookmark", item.name);
    }
  });
}

async function createPageNavigator(project, request) {
  return createGeneratedNavigator(project, request, {
    controlType: "pageNavigator",
    templateType: "pageNavigator",
    getItems: getNavigatorPages,
    applyLink: (_project, _request, definition, item) => {
      setVisualLink(definition, {
        type: "PageNavigation",
        navigationSection: item.name
      });
      setAnnotation(definition, "codex.targetPageName", item.name);
    }
  });
}

async function updateGeneratedNavigator(project, request) {
  const controlType = request.controlType;
  const visualNames = listNavigatorVisualNames(project, request.pageName, request.controlName, controlType);
  ensureExists(visualNames.length, `Navigator not found: ${request.pageName}/${request.controlName}`);

  const firstDefinition = readJson(visualFile(project, request.pageName, visualNames[0]));
  const fallbackLayout = firstDefinition.position;
  const fallbackOrientation =
    request.orientation || getAnnotation(firstDefinition, "codex.navigatorOrientation") || "horizontal";
  const fallbackSpacing = request.spacing ?? Number(getAnnotation(firstDefinition, "codex.navigatorSpacing") || 12);
  const fallbackGroupName =
    request.groupName !== undefined ? request.groupName : getAnnotation(firstDefinition, "codex.navigatorGroup");
  const fallbackShowHidden =
    request.showHiddenPages ?? getAnnotation(firstDefinition, "codex.navigatorShowHidden") === "true";
  const fallbackShowTooltip =
    request.showTooltipPages ?? getAnnotation(firstDefinition, "codex.navigatorShowTooltip") === "true";

  for (const visualName of visualNames) {
    fs.rmSync(visualDir(project, request.pageName, visualName), { recursive: true, force: true });
  }

  const nextRequest = {
    ...request,
    layout: request.layout || fallbackLayout,
    orientation: fallbackOrientation,
    spacing: fallbackSpacing,
    groupName: fallbackGroupName || undefined,
    showHiddenPages: fallbackShowHidden,
    showTooltipPages: fallbackShowTooltip
  };

  if (controlType === "bookmarkNavigator") {
    return createBookmarkNavigator(project, nextRequest);
  }

  if (controlType === "pageNavigator") {
    return createPageNavigator(project, nextRequest);
  }

  throw new Error(`Unsupported navigator control type: ${controlType}`);
}

async function updateAllPageNavigators(project) {
  const navigators = [];
  for (const pageName of listPageNames(project)) {
    const seen = new Set();
    for (const visualName of listVisualNames(project, pageName)) {
      const definition = readJson(visualFile(project, pageName, visualName));
      if (getStoredControlType(definition) !== "pageNavigator") {
        continue;
      }

      const navigatorName = getAnnotation(definition, "codex.navigatorName");
      if (!navigatorName || seen.has(navigatorName)) {
        continue;
      }

      seen.add(navigatorName);
      navigators.push({
        pageName,
        controlName: navigatorName,
        controlType: "pageNavigator"
      });
    }
  }

  for (const navigator of navigators) {
    await updateGeneratedNavigator(project, navigator);
  }
}

export async function syncGeneratedPageNavigators(project) {
  await updateAllPageNavigators(project);
}

export async function refreshCrossReportDrillthroughSetting(project) {
  let hasCrossReportDrillthrough = false;
  for (const pageName of listPageNames(project)) {
    const definition = getPage(project, pageName);
    if (
      definition.pageBinding?.type === "Drillthrough" &&
      definition.pageBinding?.referenceScope === "CrossReport"
    ) {
      hasCrossReportDrillthrough = true;
      break;
    }
  }

  const reportDefinition = getReportDefinition(project);
  reportDefinition.settings = reportDefinition.settings || {};
  reportDefinition.settings.useCrossReportDrillthrough = hasCrossReportDrillthrough;
  writeReportDefinition(project, reportDefinition);

  const validation = summarizeValidationResults(await validateJsonFiles([reportFile(project)]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }
}

export async function refreshApplyAllSlicersSetting(project) {
  let hasSlicerActionButton = false;
  for (const pageName of listPageNames(project)) {
    for (const visualName of listVisualNames(project, pageName)) {
      const definition = readJson(visualFile(project, pageName, visualName));
      const controlType = getStoredControlType(definition);
      if (controlType === "applyAllSlicersButton" || controlType === "clearAllSlicersButton") {
        hasSlicerActionButton = true;
        break;
      }
    }
    if (hasSlicerActionButton) {
      break;
    }
  }

  const reportDefinition = getReportDefinition(project);
  reportDefinition.slowDataSourceSettings = reportDefinition.slowDataSourceSettings || {};
  reportDefinition.slowDataSourceSettings.isApplyAllButtonEnabled = hasSlicerActionButton;
  writeReportDefinition(project, reportDefinition);

  const validation = summarizeValidationResults(await validateJsonFiles([reportFile(project)]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }
}

function ensurePageBindingType(project, pageName, expectedType) {
  const page = getPage(project, pageName);
  ensureExists(
    page.pageBinding?.type === expectedType,
    `Target page is not configured for ${expectedType.toLowerCase()}: ${pageName}`
  );
  return page;
}

async function configureDrillthroughPageInternal(project, request, options = {}) {
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
      buildPageBindingFilter(fieldRef, project.semanticModel, filterName, request.fieldDisplayNames?.[index], "Drillthrough")
    );
    parameters.push(
      buildPageBindingParameter(fieldRef, project.semanticModel, parameterName, filterName)
    );
  }

  definition.filterConfig = filterConfig;
  definition.pageBinding = {
    name: request.bindingName || `${request.pageName}_Drillthrough`,
    type: "Drillthrough",
    referenceScope: options.referenceScope || "Default",
    acceptsFilterContext: normalizeFilterContext(request.acceptsFilterContext),
    parameters
  };

  if (request.hidden !== false) {
    definition.visibility = "HiddenInViewMode";
  }

  writeJson(pageFile(project, request.pageName), definition);

  let backButton = null;
  const autoCreateBackButton =
    request.autoCreateBackButton ?? options.defaultAutoCreateBackButton ?? true;
  if (autoCreateBackButton) {
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

  await refreshCrossReportDrillthroughSetting(project);

  const validation = summarizeValidationResults(await validateJsonFiles([pageFile(project, request.pageName)]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return {
    page: getPage(project, request.pageName),
    backButton
  };
}

export async function configureDrillthroughPage(project, request) {
  return configureDrillthroughPageInternal(project, request, {
    referenceScope: "Default",
    defaultAutoCreateBackButton: true
  });
}

export async function configureCrossReportDrillthroughPage(project, request) {
  return configureDrillthroughPageInternal(project, request, {
    referenceScope: "CrossReport",
    defaultAutoCreateBackButton: false
  });
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
      getStoredControlType(visualDefinition) === "backButton" &&
      getAnnotation(visualDefinition, "codex.drillthroughPage") === request.pageName
    ) {
      fs.rmSync(visualDir(project, request.pageName, visualName), { recursive: true, force: true });
    }
  }

  const validation = summarizeValidationResults(await validateJsonFiles([pageFile(project, request.pageName)]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  await refreshCrossReportDrillthroughSetting(project);

  return getPage(project, request.pageName);
}

export async function clearCrossReportDrillthroughPage(project, request) {
  const definition = getPage(project, request.pageName);
  ensureExists(
    definition.pageBinding?.type === "Drillthrough" &&
      definition.pageBinding?.referenceScope === "CrossReport",
    `Target page is not configured for cross-report drillthrough: ${request.pageName}`
  );
  return clearDrillthroughPage(project, request);
}

export async function configureTooltipPage(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  refreshSemanticModel(project);

  const definition = getPage(project, request.pageName);
  const filterConfig = deepClone(definition.filterConfig || { filters: [] });
  const filterNamesToRemove = new Set((definition.pageBinding?.parameters || []).map((parameter) => parameter.boundFilter));
  filterConfig.filters = (filterConfig.filters || []).filter((filter) => !filterNamesToRemove.has(filter.name));

  const parameters = [];
  for (const [index, fieldRef] of (request.fieldRefs || []).entries()) {
    const filterName = `${request.pageName}_TooltipFilter_${index + 1}`;
    const parameterName = `TooltipParam_${index + 1}`;
    filterConfig.filters.push(
      buildPageBindingFilter(fieldRef, project.semanticModel, filterName, request.fieldDisplayNames?.[index], "User")
    );
    parameters.push(
      buildPageBindingParameter(fieldRef, project.semanticModel, parameterName, filterName)
    );
  }

  if (filterConfig.filters.length) {
    definition.filterConfig = filterConfig;
  } else {
    delete definition.filterConfig;
  }

  definition.pageBinding = {
    name: request.bindingName || `${request.pageName}_Tooltip`,
    type: "Tooltip",
    parameters
  };

  if (request.hidden !== false) {
    definition.visibility = "HiddenInViewMode";
  }

  writeJson(pageFile(project, request.pageName), definition);

  const validation = summarizeValidationResults(await validateJsonFiles([pageFile(project, request.pageName)]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return getPage(project, request.pageName);
}

export async function clearTooltipPage(project, request) {
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

  for (const pageName of listPageNames(project)) {
    for (const visualName of listVisualNames(project, pageName)) {
      const visualDefinition = readJson(visualFile(project, pageName, visualName));
      const tooltipSection =
        visualDefinition.visual?.visualContainerObjects?.visualTooltip?.[0]?.properties?.section?.expr?.Literal?.Value
          ?.replace(/^'/, "")
          .replace(/'$/, "");
      if (tooltipSection === request.pageName) {
        setVisualTooltip(visualDefinition, null);
        await saveVisualDefinition(project, pageName, visualDefinition);
      }
    }
  }

  const validation = summarizeValidationResults(await validateJsonFiles([pageFile(project, request.pageName)]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return getPage(project, request.pageName);
}

export async function assignTooltip(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.visualName, "visualName is required.");
  const definition = getVisual(project, request.pageName, request.visualName);
  if (request.tooltipPageName) {
    ensurePageBindingType(project, request.tooltipPageName, "Tooltip");
  }
  setVisualTooltip(definition, request.tooltipPageName || null);
  return saveVisualDefinition(project, request.pageName, definition);
}

export async function setVisualInteractions(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  const pageDefinition = getPage(project, request.pageName);
  pageDefinition.visualInteractions = pageDefinition.visualInteractions || [];

  const requestedInteractions = request.interactions?.length
    ? request.interactions
    : [
        {
          sourceVisualName: request.sourceVisualName,
          targetVisualName: request.targetVisualName,
          interactionType: request.interactionType
        }
      ];

  const sourcesToReplace = new Set();
  for (const interaction of requestedInteractions) {
    ensureExists(interaction.sourceVisualName, "sourceVisualName is required.");
    ensureExists(interaction.targetVisualName, "targetVisualName is required.");
    getVisual(project, request.pageName, interaction.sourceVisualName);
    getVisual(project, request.pageName, interaction.targetVisualName);
    if (request.replaceExisting) {
      sourcesToReplace.add(interaction.sourceVisualName);
    }
  }

  if (sourcesToReplace.size) {
    pageDefinition.visualInteractions = pageDefinition.visualInteractions.filter(
      (interaction) => !sourcesToReplace.has(interaction.source)
    );
  }

  for (const interaction of requestedInteractions) {
    const normalized = normalizeInteractionType(interaction.interactionType);
    const existingIndex = pageDefinition.visualInteractions.findIndex(
      (entry) =>
        entry.source === interaction.sourceVisualName && entry.target === interaction.targetVisualName
    );
    const entry = {
      source: interaction.sourceVisualName,
      target: interaction.targetVisualName,
      type: normalized
    };
    if (existingIndex >= 0) {
      pageDefinition.visualInteractions[existingIndex] = entry;
    } else {
      pageDefinition.visualInteractions.push(entry);
    }
  }

  writeJson(pageFile(project, request.pageName), pageDefinition);

  let sourceVisual = null;
  if (request.sourceVisualName && request.drillingFiltersOtherVisuals != null) {
    sourceVisual = getVisual(project, request.pageName, request.sourceVisualName);
    sourceVisual.visual = sourceVisual.visual || {};
    sourceVisual.visual.drillFilterOtherVisuals = Boolean(request.drillingFiltersOtherVisuals);
    sourceVisual = await saveVisualDefinition(project, request.pageName, sourceVisual);
  }

  const files = [pageFile(project, request.pageName)];
  if (sourceVisual) {
    files.push(visualFile(project, request.pageName, sourceVisual.name));
  }
  const validation = summarizeValidationResults(await validateJsonFiles(files));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return {
    page: getPage(project, request.pageName),
    sourceVisual
  };
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
  if (request.controlType === "pageNavigator") {
    return createPageNavigator(project, request);
  }

  const normalizedRequest = {
    ...request,
    title:
      request.title ||
      (request.controlType === "applyAllSlicersButton"
        ? "Apply all slicers"
        : request.controlType === "clearAllSlicersButton"
          ? "Clear all slicers"
          : request.title)
  };
  const definition = createActionButtonDefinition(request.controlType, normalizedRequest);
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
      ensurePageBindingType(project, request.drillthroughPageName, "Drillthrough");
      setVisualLink(definition, {
        type: "Drillthrough",
        drillthroughSection: request.drillthroughPageName
      });
      setAnnotation(definition, "codex.drillthroughTarget", request.drillthroughPageName);
      break;
    case "pageNavigationButton":
      ensureExists(request.targetPageName, "targetPageName is required for page navigation buttons.");
      getPage(project, request.targetPageName);
      setVisualLink(definition, {
        type: "PageNavigation",
        navigationSection: request.targetPageName
      });
      setAnnotation(definition, "codex.targetPageName", request.targetPageName);
      break;
    case "applyAllSlicersButton":
      setVisualLink(definition, {
        type: "ApplyAllSlicers"
      });
      setAnnotation(definition, "codex.slicerAction", "ApplyAllSlicers");
      break;
    case "clearAllSlicersButton":
      setVisualLink(definition, {
        type: "ClearAllSlicers"
      });
      setAnnotation(definition, "codex.slicerAction", "ClearAllSlicers");
      break;
    case "webUrlButton": {
      const webUrl = request.webUrl || request.action?.webUrl;
      ensureExists(webUrl, "webUrl is required for web URL buttons.");
      setVisualLink(definition, {
        type: "WebUrl",
        webUrl
      });
      setAnnotation(definition, "codex.webUrl", webUrl);
      break;
    }
    case "qnaButton": {
      const qnaQuestion = request.qnaQuestion || request.action?.qna;
      ensureExists(qnaQuestion, "qnaQuestion is required for Q&A buttons.");
      setVisualLink(definition, {
        type: "Qna",
        qna: qnaQuestion
      });
      setAnnotation(definition, "codex.qnaQuestion", qnaQuestion);
      break;
    }
    default:
      throw new Error(`Unsupported control type: ${request.controlType}`);
  }

  const saved = await saveVisualDefinition(project, request.pageName, definition);
  await refreshApplyAllSlicersSetting(project);
  return saved;
}

export async function updateControl(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.controlName, "controlName is required.");

  if (request.controlType === "bookmarkNavigator" || request.controlType === "pageNavigator") {
    return updateGeneratedNavigator(project, request);
  }

  let existingDefinition;
  let existingControlType = null;
  try {
    existingDefinition = getVisual(project, request.pageName, request.controlName);
    existingControlType = getStoredControlType(existingDefinition);
  } catch (error) {
    const bookmarkNavigatorNames = listNavigatorVisualNames(
      project,
      request.pageName,
      request.controlName,
      "bookmarkNavigator"
    );
    if (bookmarkNavigatorNames.length) {
      return updateGeneratedNavigator(project, {
        ...request,
        controlType: "bookmarkNavigator"
      });
    }

    const pageNavigatorNames = listNavigatorVisualNames(
      project,
      request.pageName,
      request.controlName,
      "pageNavigator"
    );
    if (pageNavigatorNames.length) {
      return updateGeneratedNavigator(project, {
        ...request,
        controlType: "pageNavigator"
      });
    }

    throw error;
  }

  const controlType = request.controlType || existingControlType;

  if (controlType === "bookmarkNavigator" || controlType === "pageNavigator") {
    return updateGeneratedNavigator(project, {
      ...request,
      controlType
    });
  }

  ensureExists(
    existingControlType,
    `Visual is not a managed interactive control: ${request.pageName}/${request.controlName}`
  );

  existingDefinition.position = request.layout
    ? normalizeLayout(request.layout, existingDefinition.position)
    : existingDefinition.position;
  if (request.title != null) {
    setTitle(existingDefinition, request.title);
  }
  if (request.format) {
    applyFormatting(existingDefinition, request.format);
  }

  switch (controlType) {
    case "backButton":
      setVisualLink(existingDefinition, { type: "Back" });
      break;
    case "bookmarkButton":
      ensureExists(request.bookmarkName, "bookmarkName is required for bookmark buttons.");
      getBookmark(project, request.bookmarkName);
      setVisualLink(existingDefinition, {
        type: "Bookmark",
        bookmark: request.bookmarkName
      });
      setAnnotation(existingDefinition, "codex.bookmarkName", request.bookmarkName);
      break;
    case "drillthroughButton":
      ensureExists(request.drillthroughPageName, "drillthroughPageName is required for drillthrough buttons.");
      ensurePageBindingType(project, request.drillthroughPageName, "Drillthrough");
      setVisualLink(existingDefinition, {
        type: "Drillthrough",
        drillthroughSection: request.drillthroughPageName
      });
      setAnnotation(existingDefinition, "codex.drillthroughTarget", request.drillthroughPageName);
      break;
    case "pageNavigationButton":
      ensureExists(request.targetPageName, "targetPageName is required for page navigation buttons.");
      getPage(project, request.targetPageName);
      setVisualLink(existingDefinition, {
        type: "PageNavigation",
        navigationSection: request.targetPageName
      });
      setAnnotation(existingDefinition, "codex.targetPageName", request.targetPageName);
      break;
    case "applyAllSlicersButton":
      setVisualLink(existingDefinition, {
        type: "ApplyAllSlicers"
      });
      setAnnotation(existingDefinition, "codex.slicerAction", "ApplyAllSlicers");
      break;
    case "clearAllSlicersButton":
      setVisualLink(existingDefinition, {
        type: "ClearAllSlicers"
      });
      setAnnotation(existingDefinition, "codex.slicerAction", "ClearAllSlicers");
      break;
    case "webUrlButton": {
      const webUrl =
        request.webUrl ||
        request.action?.webUrl ||
        getAnnotation(existingDefinition, "codex.webUrl");
      ensureExists(webUrl, "webUrl is required for web URL buttons.");
      setVisualLink(existingDefinition, {
        type: "WebUrl",
        webUrl
      });
      setAnnotation(existingDefinition, "codex.webUrl", webUrl);
      break;
    }
    case "qnaButton": {
      const qnaQuestion =
        request.qnaQuestion ||
        request.action?.qna ||
        getAnnotation(existingDefinition, "codex.qnaQuestion");
      ensureExists(qnaQuestion, "qnaQuestion is required for Q&A buttons.");
      setVisualLink(existingDefinition, {
        type: "Qna",
        qna: qnaQuestion
      });
      setAnnotation(existingDefinition, "codex.qnaQuestion", qnaQuestion);
      break;
    }
    default:
      throw new Error(`Unsupported control type: ${controlType}`);
  }

  const saved = await saveVisualDefinition(project, request.pageName, existingDefinition);
  await refreshApplyAllSlicersSetting(project);
  return saved;
}
