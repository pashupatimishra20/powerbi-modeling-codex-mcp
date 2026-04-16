import fs from "node:fs";
import path from "node:path";

import { getVisualTemplate } from "./templates.js";
import { createVisualName } from "./ids.js";
import { readJson, writeJson } from "./json.js";
import { resolveFieldReference } from "./semantic-model.js";
import {
  summarizeValidationResults,
  validateJsonFiles
} from "./schema-validator.js";
import {
  listVisualNames,
  pageDir,
  pageFile,
  visualDir,
  visualFile
} from "./project-service.js";

function ensureExists(value, message) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

function quoteLiteral(value) {
  const escaped = String(value ?? "").replace(/'/g, "''");
  return {
    expr: {
      Literal: {
        Value: `'${escaped}'`
      }
    }
  };
}

function booleanLiteral(value) {
  return {
    expr: {
      Literal: {
        Value: value ? "true" : "false"
      }
    }
  };
}

function ensureArrayObject(target, key) {
  if (!target[key]) {
    target[key] = [];
  }
  if (!target[key][0]) {
    target[key][0] = { properties: {} };
  }
  if (!target[key][0].properties) {
    target[key][0].properties = {};
  }
  return target[key][0].properties;
}

function normalizeLayout(layout = {}, currentPosition = {}) {
  return {
    x: layout.x ?? currentPosition.x ?? 0,
    y: layout.y ?? currentPosition.y ?? 0,
    z: layout.z ?? currentPosition.z ?? 0,
    width: layout.width ?? currentPosition.width ?? 320,
    height: layout.height ?? currentPosition.height ?? 180,
    tabOrder: layout.tabOrder ?? currentPosition.tabOrder ?? currentPosition.z ?? 0
  };
}

function setTitle(visualDefinition, title) {
  if (title == null) {
    return;
  }

  visualDefinition.visual.visualContainerObjects =
    visualDefinition.visual.visualContainerObjects || {};
  const titleProps = ensureArrayObject(visualDefinition.visual.visualContainerObjects, "title");
  titleProps.text = quoteLiteral(title);
}

function setSubtitle(visualDefinition, subtitle) {
  if (subtitle == null) {
    return;
  }

  visualDefinition.visual.visualContainerObjects =
    visualDefinition.visual.visualContainerObjects || {};
  const subtitleProps = ensureArrayObject(
    visualDefinition.visual.visualContainerObjects,
    "subTitle"
  );
  subtitleProps.show = booleanLiteral(true);
  subtitleProps.text = quoteLiteral(subtitle);
}

function setTextValue(visualDefinition, textValue) {
  if (textValue == null) {
    return;
  }

  visualDefinition.visual.objects = visualDefinition.visual.objects || {};
  const generalProps = ensureArrayObject(visualDefinition.visual.objects, "general");
  generalProps.paragraphs = quoteLiteral(textValue);
}

function applyFormatting(visualDefinition, format = {}) {
  if (!format || typeof format !== "object") {
    return;
  }

  if (format.title != null) {
    setTitle(visualDefinition, format.title);
  }
  if (format.subtitle != null) {
    setSubtitle(visualDefinition, format.subtitle);
  }
  if (format.textValue != null) {
    setTextValue(visualDefinition, format.textValue);
  }

  visualDefinition.visual.objects = visualDefinition.visual.objects || {};

  if (format.legendVisible != null) {
    const legendProps = ensureArrayObject(visualDefinition.visual.objects, "legend");
    legendProps.show = booleanLiteral(Boolean(format.legendVisible));
  }
  if (format.dataLabelsVisible != null) {
    const labelProps = ensureArrayObject(visualDefinition.visual.objects, "labels");
    labelProps.show = booleanLiteral(Boolean(format.dataLabelsVisible));
  }
  if (format.background?.color) {
    const backgroundProps = ensureArrayObject(visualDefinition.visual.objects, "background");
    backgroundProps.color = quoteLiteral(format.background.color);
  }
  if (format.basicColor) {
    const dataPointProps = ensureArrayObject(visualDefinition.visual.objects, "dataPoint");
    dataPointProps.fill = quoteLiteral(format.basicColor);
  }
  if (format.fontSize != null) {
    visualDefinition.visual.visualContainerObjects =
      visualDefinition.visual.visualContainerObjects || {};
    const titleProps = ensureArrayObject(visualDefinition.visual.visualContainerObjects, "title");
    titleProps.fontSize = {
      expr: {
        Literal: {
          Value: String(format.fontSize)
        }
      }
    };
  }
}

function getDefaultRoleBindings(visualType) {
  switch (visualType) {
    case "card":
    case "multiRowCard":
    case "table":
    case "matrix":
    case "slicer":
      return {
        Values: ["values", "value", "rows", "columns", "category"]
      };
    case "textbox":
      return {};
    case "pieChart":
    case "clusteredBarChart":
    case "clusteredColumnChart":
    case "lineChart":
      return {
        Category: ["category", "categories", "legend", "x"],
        Y: ["values", "value", "y"]
      };
    default:
      return {
        Values: ["values"]
      };
  }
}

function normalizeBindingsForVisual(visualType, bindings = {}) {
  const mapping = getDefaultRoleBindings(visualType);
  const normalized = {};

  for (const [roleName, aliases] of Object.entries(mapping)) {
    if (bindings[roleName] != null) {
      normalized[roleName] = Array.isArray(bindings[roleName])
        ? bindings[roleName]
        : [bindings[roleName]];
      continue;
    }

    for (const alias of aliases) {
      if (bindings[alias] != null) {
        normalized[roleName] = Array.isArray(bindings[alias])
          ? bindings[alias]
          : [bindings[alias]];
        break;
      }
    }
  }

  for (const [rawRole, refs] of Object.entries(bindings)) {
    if (!normalized[rawRole]) {
      normalized[rawRole] = Array.isArray(refs) ? refs : [refs];
    }
  }

  return normalized;
}

function buildFieldExpression(parsedRef, aggregateColumns) {
  if (parsedRef.kind === "column") {
    const columnExpression = {
      Column: {
        Expression: {
          SourceRef: {
            Entity: parsedRef.tableName
          }
        },
        Property: parsedRef.columnName
      }
    };

    if (!aggregateColumns) {
      return {
        expression: columnExpression,
        queryRef: `${parsedRef.tableName}.${parsedRef.columnName}`
      };
    }

    return {
      expression: {
        Aggregation: {
          Expression: columnExpression,
          Function: 0
        }
      },
      queryRef: `Sum(${parsedRef.tableName}.${parsedRef.columnName})`
    };
  }

  if (parsedRef.kind === "measure") {
    return {
      expression: {
        Measure: {
          Expression: {
            SourceRef: {
              Entity: parsedRef.tableName
            }
          },
          Property: parsedRef.measureName
        }
      },
      queryRef: `${parsedRef.tableName}.${parsedRef.measureName}`
    };
  }

  return {
    expression: {
      HierarchyLevel: {
        Expression: {
          Hierarchy: {
            Expression: {
              SourceRef: {
                Entity: parsedRef.tableName
              }
            },
            Hierarchy: parsedRef.hierarchyName
          }
        },
        Level: parsedRef.levelName
      }
    },
    queryRef: `${parsedRef.tableName}.${parsedRef.hierarchyName}.${parsedRef.levelName}`
  };
}

function shouldAggregateRole(roleName, visualType) {
  if (visualType === "table" || visualType === "matrix" || visualType === "slicer") {
    return false;
  }

  return roleName === "Y" || (roleName === "Values" && visualType !== "multiRowCard");
}

function buildQueryState(visualType, bindings, semanticModel) {
  if (visualType === "textbox") {
    return null;
  }

  const normalizedBindings = normalizeBindingsForVisual(visualType, bindings);
  const entries = Object.entries(normalizedBindings).filter(([, refs]) => Array.isArray(refs) && refs.length);
  if (!entries.length) {
    throw new Error(`Bindings are required for visual type ${visualType}.`);
  }

  const queryState = {};
  for (const [roleName, refs] of entries) {
    queryState[roleName] = {
      projections: refs.map((ref, index) => {
        const parsedRef = resolveFieldReference(ref, semanticModel);
        const built = buildFieldExpression(parsedRef, shouldAggregateRole(roleName, visualType));
        return {
          field: built.expression,
          queryRef: built.queryRef,
          active: index === 0 || roleName !== "Values"
        };
      })
    };
  }

  return queryState;
}

function createDefaultSort(bindings, visualType, semanticModel) {
  const normalizedBindings = normalizeBindingsForVisual(visualType, bindings);
  const firstRole = normalizedBindings.Y?.[0] ?? normalizedBindings.Values?.[0] ?? normalizedBindings.Category?.[0];
  if (!firstRole) {
    return undefined;
  }

  const parsedRef = resolveFieldReference(firstRole, semanticModel);
  const built = buildFieldExpression(parsedRef, parsedRef.kind === "column");
  return {
    sort: [
      {
        field: built.expression,
        direction: normalizedBindings.Category ? "Ascending" : "Descending"
      }
    ],
    isDefaultSort: true
  };
}

function refreshVisualQuery(visualDefinition, bindings, semanticModel, visualType, sortDefinition) {
  if (visualType === "textbox") {
    delete visualDefinition.visual.query;
    return;
  }

  visualDefinition.visual.query = {
    queryState: buildQueryState(visualType, bindings, semanticModel)
  };

  const resolvedSort = sortDefinition || createDefaultSort(bindings, visualType, semanticModel);
  if (resolvedSort) {
    visualDefinition.visual.query.sortDefinition = resolvedSort;
  }
}

function getTitle(visualDefinition) {
  return (
    visualDefinition.visual?.visualContainerObjects?.title?.[0]?.properties?.text?.expr?.Literal?.Value ?? null
  );
}

export function listVisuals(project, pageName) {
  ensureExists(fs.existsSync(pageDir(project, pageName)), `Page not found: ${pageName}`);
  return listVisualNames(project, pageName).map((visualName) => {
    const definition = readJson(visualFile(project, pageName, visualName));
    return {
      name: definition.name,
      visualType: definition.visual?.visualType || null,
      position: definition.position,
      hidden: Boolean(definition.isHidden),
      title: getTitle(definition)
    };
  });
}

export function getVisual(project, pageName, visualName) {
  const filePath = visualFile(project, pageName, visualName);
  ensureExists(fs.existsSync(filePath), `Visual not found: ${pageName}/${visualName}`);
  return readJson(filePath);
}

export async function createVisual(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(fs.existsSync(pageFile(project, request.pageName)), `Page not found: ${request.pageName}`);
  ensureExists(request.visualType, "visualType is required.");

  const visualDefinition = getVisualTemplate(request.visualType);
  const visualName = createVisualName(request.name);
  visualDefinition.name = visualName;
  visualDefinition.position = normalizeLayout(request.layout, visualDefinition.position);
  if (request.visibility != null) {
    visualDefinition.isHidden = !request.visibility;
  }

  setTitle(visualDefinition, request.title);
  setSubtitle(visualDefinition, request.subtitle);
  setTextValue(visualDefinition, request.textValue);
  applyFormatting(visualDefinition, request.format);

  refreshVisualQuery(
    visualDefinition,
    request.bindings || {},
    project.semanticModel,
    request.visualType,
    request.sort || undefined
  );

  if (request.filters) {
    visualDefinition.filterConfig = request.filters;
  }

  const filePath = visualFile(project, request.pageName, visualName);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeJson(filePath, visualDefinition);

  const validation = summarizeValidationResults(await validateJsonFiles([filePath]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return getVisual(project, request.pageName, visualName);
}

function updateVisualInternal(project, request, definition) {
  const visualType = definition.visual?.visualType;
  if (request.layout) {
    definition.position = normalizeLayout(request.layout, definition.position);
  }
  if (request.visibility != null) {
    definition.isHidden = !request.visibility;
  }
  if (request.title != null) {
    setTitle(definition, request.title);
  }
  if (request.subtitle != null) {
    setSubtitle(definition, request.subtitle);
  }
  if (request.textValue != null) {
    setTextValue(definition, request.textValue);
  }
  if (request.format) {
    applyFormatting(definition, request.format);
  }
  if (request.bindings) {
    refreshVisualQuery(
      definition,
      request.bindings,
      project.semanticModel,
      visualType,
      request.sort || definition.visual?.query?.sortDefinition
    );
  } else if (request.sort) {
    definition.visual.query = definition.visual.query || {};
    definition.visual.query.sortDefinition = request.sort;
  }
  if (request.filters != null) {
    definition.filterConfig = request.filters;
  }
}

export async function updateVisual(project, request) {
  const definition = getVisual(project, request.pageName, request.visualName);
  updateVisualInternal(project, request, definition);
  const filePath = visualFile(project, request.pageName, request.visualName);
  writeJson(filePath, definition);
  const validation = summarizeValidationResults(await validateJsonFiles([filePath]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }
  return getVisual(project, request.pageName, request.visualName);
}

export async function bindVisualFields(project, request) {
  ensureExists(request.bindings, "bindings are required for BindFields.");
  return updateVisual(project, request);
}

export async function setVisualFormatting(project, request) {
  ensureExists(request.format || request.title || request.subtitle || request.textValue, "Formatting payload is required.");
  return updateVisual(project, request);
}

export async function deleteVisual(project, request) {
  const targetDir = visualDir(project, request.pageName, request.visualName);
  ensureExists(fs.existsSync(targetDir), `Visual not found: ${request.pageName}/${request.visualName}`);
  fs.rmSync(targetDir, { recursive: true, force: true });
  return {
    deletedVisualName: request.visualName,
    visuals: listVisuals(project, request.pageName)
  };
}

export async function duplicateVisual(project, request) {
  const sourceDir = visualDir(project, request.pageName, request.visualName);
  ensureExists(fs.existsSync(sourceDir), `Visual not found: ${request.pageName}/${request.visualName}`);
  const destinationPageName = request.targetPageName || request.pageName;
  ensureExists(fs.existsSync(pageDir(project, destinationPageName)), `Target page not found: ${destinationPageName}`);

  const duplicateName = createVisualName(request.name);
  const destinationDir = visualDir(project, destinationPageName, duplicateName);
  fs.mkdirSync(path.dirname(destinationDir), { recursive: true });
  fs.cpSync(sourceDir, destinationDir, { recursive: true });
  const filePath = visualFile(project, destinationPageName, duplicateName);
  const definition = readJson(filePath);
  definition.name = duplicateName;
  if (request.layout) {
    definition.position = normalizeLayout(request.layout, definition.position);
  }
  writeJson(filePath, definition);

  const validation = summarizeValidationResults(await validateJsonFiles([filePath]));
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }
  return getVisual(project, destinationPageName, duplicateName);
}

export async function moveVisual(project, request) {
  ensureExists(request.visualName, "visualName is required.");
  const destinationPageName = request.targetPageName || request.pageName;
  ensureExists(destinationPageName, "targetPageName or pageName is required.");

  if (destinationPageName === request.pageName) {
    return updateVisual(project, request);
  }

  const duplicated = await duplicateVisual(project, {
    ...request,
    targetPageName: destinationPageName
  });
  await deleteVisual(project, request);
  return duplicated;
}
