import fs from "node:fs";

import { SCHEMA_URLS } from "./constants.js";
import { writeJson, readJson } from "./json.js";
import {
  listMobileVisualNames,
  listVisualNames,
  pageDir,
  visualFile,
  visualMobileStateFile
} from "./project-service.js";
import {
  summarizeValidationResults,
  validateJsonFiles
} from "./schema-validator.js";
import { getVisual, normalizeLayout } from "./visual-service.js";
import {
  booleanLiteral,
  ensureArrayObject,
  numberLiteral,
  quoteLiteral
} from "./format-utils.js";

const MOBILE_CANVAS_WIDTH = 320;
const MOBILE_PADDING = 8;

function ensureExists(value, message) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

function normalizeMobilePosition(layout = {}, currentPosition = {}) {
  const normalized = normalizeLayout(layout, currentPosition);
  return {
    x: normalized.x,
    y: normalized.y,
    z: normalized.z,
    width: normalized.width,
    height: normalized.height,
    tabOrder: normalized.tabOrder
  };
}

function buildDefaultMobileState(position) {
  return {
    $schema: SCHEMA_URLS.visualMobileState,
    position
  };
}

function applyMobileFormatting(mobileState, format = {}) {
  if (!format || typeof format !== "object") {
    return;
  }

  if (format.title != null) {
    mobileState.visualContainerObjects = mobileState.visualContainerObjects || {};
    const titleProps = ensureArrayObject(mobileState.visualContainerObjects, "title");
    titleProps.show = booleanLiteral(true);
    titleProps.text = quoteLiteral(format.title);
    if (format.fontSize != null) {
      titleProps.fontSize = numberLiteral(format.fontSize);
    }
  }

  if (format.background?.color) {
    mobileState.visualContainerObjects = mobileState.visualContainerObjects || {};
    const backgroundProps = ensureArrayObject(mobileState.visualContainerObjects, "background");
    backgroundProps.show = booleanLiteral(true);
    backgroundProps.color = quoteLiteral(format.background.color);
  }
}

async function validateMobileState(filePath) {
  const validation = summarizeValidationResults(await validateJsonFiles([filePath]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }
}

function getMobileState(project, pageName, visualName) {
  const filePath = visualMobileStateFile(project, pageName, visualName);
  ensureExists(fs.existsSync(filePath), `Mobile layout not found: ${pageName}/${visualName}`);
  return readJson(filePath);
}

async function saveMobileState(project, pageName, visualName, state) {
  const filePath = visualMobileStateFile(project, pageName, visualName);
  writeJson(filePath, state);
  await validateMobileState(filePath);
  return getMobileState(project, pageName, visualName);
}

function calculateAutoMobilePosition(visualDefinition, index, currentY) {
  const desktopPosition = visualDefinition.position || {};
  const scale = desktopPosition.width
    ? Math.min(1, (MOBILE_CANVAS_WIDTH - MOBILE_PADDING * 2) / desktopPosition.width)
    : 1;
  const width = Math.max(80, Math.round((desktopPosition.width || 304) * scale));
  const height = Math.max(48, Math.round((desktopPosition.height || 160) * scale));
  return {
    x: MOBILE_PADDING,
    y: currentY,
    z: index,
    width,
    height,
    tabOrder: index
  };
}

export function listMobileLayouts(project, pageName) {
  ensureExists(fs.existsSync(pageDir(project, pageName)), `Page not found: ${pageName}`);
  return listMobileVisualNames(project, pageName).map((visualName) => ({
    visualName,
    mobileState: getMobileState(project, pageName, visualName)
  }));
}

export function getMobileLayout(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  if (!request.visualName) {
    return listMobileLayouts(project, request.pageName);
  }
  return getMobileState(project, request.pageName, request.visualName);
}

export async function placeMobileVisual(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.visualName, "visualName is required.");
  getVisual(project, request.pageName, request.visualName);

  const state = buildDefaultMobileState(
    normalizeMobilePosition(request.layout, {
      x: MOBILE_PADDING,
      y: MOBILE_PADDING,
      z: 0,
      width: MOBILE_CANVAS_WIDTH - MOBILE_PADDING * 2,
      height: 160,
      tabOrder: 0
    })
  );
  applyMobileFormatting(state, request.format);
  return saveMobileState(project, request.pageName, request.visualName, state);
}

export async function updateMobileVisual(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.visualName, "visualName is required.");
  const existing = getMobileState(project, request.pageName, request.visualName);
  existing.position = request.layout
    ? normalizeMobilePosition(request.layout, existing.position)
    : existing.position;
  applyMobileFormatting(existing, request.format);
  return saveMobileState(project, request.pageName, request.visualName, existing);
}

export async function autoCreateMobileLayout(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  const visualNames = listVisualNames(project, request.pageName);
  const visuals = visualNames
    .map((visualName) => getVisual(project, request.pageName, visualName))
    .sort((left, right) => {
      const leftPos = left.position || {};
      const rightPos = right.position || {};
      return (leftPos.y || 0) - (rightPos.y || 0) || (leftPos.x || 0) - (rightPos.x || 0);
    });

  let currentY = MOBILE_PADDING;
  const created = [];
  for (const [index, visualDefinition] of visuals.entries()) {
    const position = calculateAutoMobilePosition(visualDefinition, index, currentY);
    currentY += position.height + MOBILE_PADDING;
    created.push(
      await saveMobileState(
        project,
        request.pageName,
        visualDefinition.name,
        buildDefaultMobileState(position)
      )
    );
  }

  return created;
}

export async function removeMobileVisual(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.visualName, "visualName is required.");
  const filePath = visualMobileStateFile(project, request.pageName, request.visualName);
  ensureExists(fs.existsSync(filePath), `Mobile layout not found: ${request.pageName}/${request.visualName}`);
  fs.rmSync(filePath, { force: true });
  return {
    removedVisualName: request.visualName,
    mobileLayouts: listMobileLayouts(project, request.pageName)
  };
}

export async function clearMobileLayout(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  for (const visualName of listMobileVisualNames(project, request.pageName)) {
    fs.rmSync(visualMobileStateFile(project, request.pageName, visualName), { force: true });
  }
  return {
    pageName: request.pageName,
    mobileLayouts: []
  };
}
