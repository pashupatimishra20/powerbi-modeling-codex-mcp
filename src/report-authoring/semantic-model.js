import fs from "node:fs";
import path from "node:path";

function collectFiles(rootDir, extension, result = []) {
  if (!fs.existsSync(rootDir)) {
    return result;
  }

  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, extension, result);
      continue;
    }

    if (entry.isFile() && fullPath.toLowerCase().endsWith(extension)) {
      result.push(fullPath);
    }
  }

  return result;
}

function ensureTable(index, tableName) {
  if (!index.tables.has(tableName)) {
    index.tables.set(tableName, {
      columns: new Set(),
      measures: new Set(),
      hierarchies: new Map()
    });
  }

  return index.tables.get(tableName);
}

function addHierarchyLevel(table, hierarchyName, levelName) {
  if (!table.hierarchies.has(hierarchyName)) {
    table.hierarchies.set(hierarchyName, new Set());
  }

  table.hierarchies.get(hierarchyName).add(levelName);
}

function normalizeTmdlIdentifier(value) {
  const trimmed = String(value || "").trim();
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }

  return trimmed;
}

function parseTmdlFile(filePath, index) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  let currentTable = null;
  let currentHierarchy = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) {
      continue;
    }

    let match = line.match(/^table\s+(.+)$/i);
    if (match) {
      currentTable = normalizeTmdlIdentifier(match[1]);
      currentHierarchy = null;
      ensureTable(index, currentTable);
      continue;
    }

    match = line.match(/^hierarchy\s+(.+)$/i);
    if (match && currentTable) {
      currentHierarchy = normalizeTmdlIdentifier(match[1]);
      addHierarchyLevel(ensureTable(index, currentTable), currentHierarchy, "__placeholder__");
      ensureTable(index, currentTable).hierarchies.get(currentHierarchy).delete("__placeholder__");
      continue;
    }

    match = line.match(/^level\s+(.+)$/i);
    if (match && currentTable && currentHierarchy) {
      addHierarchyLevel(
        ensureTable(index, currentTable),
        currentHierarchy,
        normalizeTmdlIdentifier(match[1])
      );
      continue;
    }

    match = line.match(/^column\s+(.+)$/i);
    if (match && currentTable) {
      ensureTable(index, currentTable).columns.add(normalizeTmdlIdentifier(match[1]));
      continue;
    }

    match = line.match(/^measure\s+(.+?)\s*=/i);
    if (match && currentTable) {
      const measureName = normalizeTmdlIdentifier(match[1]);
      ensureTable(index, currentTable).measures.add(measureName);
      index.measures.set(measureName, currentTable);
    }
  }
}

export function buildSemanticModelIndex(semanticModelRoot) {
  const definitionRoot = path.join(semanticModelRoot, "definition");
  const index = {
    tables: new Map(),
    measures: new Map()
  };

  for (const filePath of collectFiles(definitionRoot, ".tmdl")) {
    parseTmdlFile(filePath, index);
  }

  return index;
}

export function serializeSemanticModelIndex(index) {
  return {
    tables: [...index.tables.entries()].map(([name, table]) => ({
      name,
      columns: [...table.columns].sort(),
      measures: [...table.measures].sort(),
      hierarchies: [...table.hierarchies.entries()].map(([hierarchy, levels]) => ({
        name: hierarchy,
        levels: [...levels].sort()
      }))
    }))
  };
}

export function searchBindableFields(semanticModel, search = "", limit = 25) {
  const normalizedSearch = String(search || "").trim().toLowerCase();
  const maxResults = Math.max(1, Number(limit) || 25);
  const results = [];

  for (const [tableName, table] of semanticModel.tables.entries()) {
    for (const columnName of table.columns) {
      results.push({
        kind: "column",
        tableName,
        name: columnName,
        reference: `${tableName}[${columnName}]`
      });
    }

    for (const measureName of table.measures) {
      results.push({
        kind: "measure",
        tableName,
        name: measureName,
        reference: `[${measureName}]`
      });
    }

    for (const [hierarchyName, levels] of table.hierarchies.entries()) {
      for (const levelName of levels) {
        results.push({
          kind: "hierarchyLevel",
          tableName,
          name: `${hierarchyName}.${levelName}`,
          reference: `${tableName}[${hierarchyName}].[${levelName}]`
        });
      }
    }
  }

  const filtered = normalizedSearch
    ? results.filter((item) =>
        `${item.reference} ${item.name} ${item.tableName}`.toLowerCase().includes(normalizedSearch)
      )
    : results;

  return filtered
    .sort((left, right) => left.reference.localeCompare(right.reference))
    .slice(0, maxResults);
}

export function resolveFieldReference(ref, semanticModel) {
  const trimmed = String(ref || "").trim();

  let match = trimmed.match(/^(.+)\[(.+)\]\.\[(.+)\]$/);
  if (match) {
    const [, tableNameRaw, hierarchyNameRaw, levelNameRaw] = match;
    const tableName = normalizeTmdlIdentifier(tableNameRaw);
    const hierarchyName = normalizeTmdlIdentifier(hierarchyNameRaw);
    const levelName = normalizeTmdlIdentifier(levelNameRaw);
    const table = semanticModel.tables.get(tableName);
    if (!table) {
      throw new Error(`Unknown table in hierarchy reference: ${trimmed}`);
    }

    const hierarchy = table.hierarchies.get(hierarchyName);
    if (!hierarchy || !hierarchy.has(levelName)) {
      throw new Error(`Unknown hierarchy level reference: ${trimmed}`);
    }

    return {
      kind: "hierarchyLevel",
      tableName,
      hierarchyName,
      levelName
    };
  }

  match = trimmed.match(/^\[(.+)\]$/);
  if (match) {
    const measureName = normalizeTmdlIdentifier(match[1]);
    const tableName = semanticModel.measures.get(measureName);
    if (!tableName) {
      throw new Error(`Unknown measure reference: ${trimmed}`);
    }

    return {
      kind: "measure",
      tableName,
      measureName
    };
  }

  match = trimmed.match(/^(.+)\[(.+)\]$/);
  if (match) {
    const tableName = normalizeTmdlIdentifier(match[1]);
    const columnName = normalizeTmdlIdentifier(match[2]);
    const table = semanticModel.tables.get(tableName);
    if (!table || !table.columns.has(columnName)) {
      throw new Error(`Unknown column reference: ${trimmed}`);
    }

    return {
      kind: "column",
      tableName,
      columnName
    };
  }

  throw new Error(`Unsupported field reference format: ${trimmed}`);
}
