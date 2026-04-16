import fs from "node:fs";
import path from "node:path";

import {
  callModelingTool,
  withModelingClient
} from "./modeling-mcp-client.js";
import { buildFieldExpressionFromRef, buildNameOfReference } from "./query-utils.js";
import { resolveFieldReference } from "./semantic-model.js";
import { refreshSemanticModel } from "./project-service.js";
import { bindVisualFields, createVisual, getVisual } from "./visual-service.js";

function ensureExists(value, message) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

function getFieldParameterColumnReference(parameterName) {
  return `${parameterName}[${parameterName}]`;
}

function buildFieldParameterProjection(parameterName) {
  const built = buildFieldExpressionFromRef(
    {
      kind: "column",
      tableName: parameterName,
      columnName: parameterName
    },
    null,
    false
  );
  return {
    expression: built.expression,
    queryRef: `${parameterName}.${parameterName}`
  };
}

function normalizeParameterFields(fields, semanticModel) {
  ensureExists(fields?.length, "Field parameter definitions are required.");
  return fields.map((field, index) => {
    const parsedRef = resolveFieldReference(field.reference, semanticModel);
    ensureExists(
      parsedRef.kind === "column" || parsedRef.kind === "measure",
      `Field parameters only support explicit columns or measures: ${field.reference}`
    );
    return {
      ...field,
      parsedRef,
      order: field.order ?? index
    };
  });
}

function buildFieldParameterExpression(fields, semanticModel) {
  const normalized = normalizeParameterFields(fields, semanticModel);
  const rows = normalized.map(
    (field) =>
      `    ("${String(field.label).replace(/"/g, "\"\"")}", ${buildNameOfReference(field.reference, semanticModel)}, ${field.order})`
  );
  return `{\n${rows.join(",\n")}\n}`;
}

async function withProjectModelConnection(project, callback) {
  ensureExists(
    project.semanticModelRoot,
    "Field parameter operations require a report project with a byPath semantic model."
  );

  return withModelingClient(async (client) => {
    await callModelingTool(client, "connection_operations", {
      Operation: "ConnectFolder",
      FolderPath: project.semanticModelRoot
    });

    return callback(client);
  });
}

function listTmdlFiles(rootDir, result = []) {
  if (!rootDir || !fs.existsSync(rootDir)) {
    return result;
  }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      listTmdlFiles(fullPath, result);
      continue;
    }
    if (entry.isFile() && fullPath.toLowerCase().endsWith(".tmdl")) {
      result.push(fullPath);
    }
  }

  return result;
}

export function listFieldParameters(project) {
  const rootDir = project.semanticModelRoot
    ? path.join(project.semanticModelRoot, "definition", "tables")
    : null;

  return listTmdlFiles(rootDir).flatMap((filePath) => {
    const content = fs.readFileSync(filePath, "utf8");
    if (!content.includes("NAMEOF(")) {
      return [];
    }

    const tableMatch = content.match(/^table\s+(.+)$/im);
    if (!tableMatch) {
      return [];
    }

    return [
      {
        name: tableMatch[1].trim().replace(/^'|'$/g, ""),
        filePath,
        preview: content.split(/\r?\n/).slice(0, 10).join("\n")
      }
    ];
  });
}

export async function createFieldParameter(project, request) {
  refreshSemanticModel(project);
  const daxExpression = buildFieldParameterExpression(request.fields, project.semanticModel);

  await withProjectModelConnection(project, async (client) => {
    await callModelingTool(client, "table_operations", {
      Operation: "Create",
      Definitions: [
        {
          Name: request.parameterName,
          DaxExpression: daxExpression
        }
      ]
    });
  });

  refreshSemanticModel(project);

  const result = {
    parameterName: request.parameterName,
    daxExpression
  };

  if (request.createSlicer) {
    result.slicer = await createFieldParameterSlicer(project, {
      parameterName: request.parameterName,
      pageName: request.slicerPageName || request.pageName,
      slicerName: request.slicerName,
      layout: request.layout
    });
  }

  return result;
}

export async function updateFieldParameter(project, request) {
  await deleteFieldParameter(project, { parameterName: request.parameterName });
  return createFieldParameter(project, request);
}

export async function deleteFieldParameter(project, request) {
  await withProjectModelConnection(project, async (client) => {
    await callModelingTool(client, "table_operations", {
      Operation: "Delete",
      References: [
        {
          Name: request.parameterName
        }
      ],
      ShouldCascadeDelete: true
    });
  });

  refreshSemanticModel(project);
  return {
    deletedParameterName: request.parameterName
  };
}

export async function bindFieldParameterToVisual(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.visualName, "visualName is required.");
  ensureExists(request.role, "role is required.");

  const projection = buildFieldParameterProjection(request.parameterName);
  const existing = getVisual(project, request.pageName, request.visualName);
  const existingBindings = {};
  for (const [roleName, roleState] of Object.entries(existing.visual?.query?.queryState || {})) {
    existingBindings[roleName] = (roleState.projections || []).map((item) => ({
      expression: item.field,
      queryRef: item.queryRef,
      active: item.active,
      displayName: item.displayName
    }));
  }
  existingBindings[request.role] = [projection];

  return bindVisualFields(project, {
    pageName: request.pageName,
    visualName: request.visualName,
    bindings: existingBindings
  });
}

export async function createFieldParameterSlicer(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  const projection = buildFieldParameterProjection(request.parameterName);
  return createVisual(project, {
    pageName: request.pageName,
    name: request.slicerName || request.parameterName,
    visualType: "slicer",
    bindings: {
      values: [projection]
    },
    layout: request.layout,
    title: request.displayName || request.parameterName
  });
}
