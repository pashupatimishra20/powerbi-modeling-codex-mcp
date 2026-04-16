import fs from "node:fs";

import {
  DEFAULT_BOOKMARK_EXPLORATION_VERSION,
  SCHEMA_URLS
} from "./constants.js";
import { createBookmarkGroupName, createBookmarkName } from "./ids.js";
import { deepClone, readJson, writeJson } from "./json.js";
import {
  bookmarkFile,
  bookmarksMetadataFile,
  getBookmarksMetadata,
  listBookmarkNames,
  listPageNames,
  listVisualNames,
  openProject,
  writeBookmarksMetadata
} from "./project-service.js";
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

function isBookmarkGroup(item) {
  return Array.isArray(item?.children);
}

function deepMerge(baseValue, overrideValue) {
  if (
    !baseValue ||
    !overrideValue ||
    typeof baseValue !== "object" ||
    typeof overrideValue !== "object" ||
    Array.isArray(baseValue) ||
    Array.isArray(overrideValue)
  ) {
    return overrideValue === undefined ? baseValue : overrideValue;
  }

  const merged = { ...baseValue };
  for (const [key, value] of Object.entries(overrideValue)) {
    merged[key] = deepMerge(baseValue[key], value);
  }
  return merged;
}

function getBookmarkGroup(project, groupName) {
  return getBookmarksMetadata(project).items.find(
    (item) => isBookmarkGroup(item) && item.name === groupName
  );
}

function buildDefaultExplorationState(project, pageName) {
  const pages = listPageNames(project);
  const activeSection = pageName || pages[0] || "ReportSection";
  const sections = Object.fromEntries(
    pages.map((currentPageName) => [
      currentPageName,
      {
        visualContainers: Object.fromEntries(
          listVisualNames(project, currentPageName).map((visualName) => [visualName, {}])
        )
      }
    ])
  );

  if (!sections[activeSection]) {
    sections[activeSection] = { visualContainers: {} };
  }

  return {
    version: DEFAULT_BOOKMARK_EXPLORATION_VERSION,
    activeSection,
    sections
  };
}

function buildBookmarkDefinition(project, request) {
  const bookmarkName = createBookmarkName(request.bookmarkName || request.displayName);
  const base = {
    $schema: SCHEMA_URLS.bookmark,
    name: bookmarkName,
    displayName: request.displayName || bookmarkName,
    explorationState: buildDefaultExplorationState(project, request.pageName)
  };

  if (request.explorationState) {
    base.explorationState = deepMerge(base.explorationState, deepClone(request.explorationState));
  }

  if (request.sections) {
    base.explorationState.sections = deepMerge(base.explorationState.sections, deepClone(request.sections));
  }

  if (request.filters) {
    base.explorationState.filters = deepClone(request.filters);
  }

  if (request.objects) {
    base.explorationState.objects = deepClone(request.objects);
  }

  if (request.options) {
    base.options = deepClone(request.options);
  }

  return base;
}

function addBookmarkToMetadata(metadata, bookmarkName, groupName = null) {
  metadata.items = metadata.items || [];
  metadata.items = metadata.items.filter((item) => !(item.name === bookmarkName && !isBookmarkGroup(item)));
  for (const item of metadata.items) {
    if (isBookmarkGroup(item)) {
      item.children = (item.children || []).filter((childName) => childName !== bookmarkName);
    }
  }

  if (groupName) {
    const group = metadata.items.find((item) => isBookmarkGroup(item) && item.name === groupName);
    ensureExists(group, `Bookmark group not found: ${groupName}`);
    group.children = [...new Set([...(group.children || []), bookmarkName])];
    return;
  }

  metadata.items.push({ name: bookmarkName });
}

function removeBookmarkFromMetadata(metadata, bookmarkName) {
  metadata.items = (metadata.items || []).filter(
    (item) => !(item.name === bookmarkName && !isBookmarkGroup(item))
  );
  for (const item of metadata.items || []) {
    if (isBookmarkGroup(item)) {
      item.children = (item.children || []).filter((childName) => childName !== bookmarkName);
    }
  }
}

function validateBookmarkFiles(project, bookmarkName, includeMetadata = true) {
  const files = [bookmarkFile(project, bookmarkName)];
  if (includeMetadata) {
    files.push(bookmarksMetadataFile(project));
  }

  return files;
}

function getBookmarkGroupLookup(project) {
  const metadata = getBookmarksMetadata(project);
  const lookup = new Map();
  for (const item of metadata.items || []) {
    if (!isBookmarkGroup(item)) {
      continue;
    }
    for (const childName of item.children || []) {
      lookup.set(childName, {
        name: item.name,
        displayName: item.displayName
      });
    }
  }
  return lookup;
}

export function listBookmarks(project) {
  const groupLookup = getBookmarkGroupLookup(project);
  return listBookmarkNames(project).map((bookmarkName) => {
    const definition = readJson(bookmarkFile(project, bookmarkName));
    const group = groupLookup.get(bookmarkName) || null;
    return {
      name: definition.name,
      displayName: definition.displayName,
      pageName: definition.explorationState?.activeSection || null,
      groupName: group?.name || null,
      groupDisplayName: group?.displayName || null,
      options: definition.options || null
    };
  });
}

export function getBookmark(project, bookmarkName) {
  const filePath = bookmarkFile(project, bookmarkName);
  ensureExists(fs.existsSync(filePath), `Bookmark not found: ${bookmarkName}`);
  return readJson(filePath);
}

export async function createBookmark(project, request) {
  const definition = buildBookmarkDefinition(project, request);
  const filePath = bookmarkFile(project, definition.name);
  ensureExists(!fs.existsSync(filePath), `Bookmark already exists: ${definition.name}`);

  writeJson(filePath, definition);

  const metadata = getBookmarksMetadata(project);
  addBookmarkToMetadata(metadata, definition.name, request.groupName || null);
  writeBookmarksMetadata(project, metadata);

  const validation = summarizeValidationResults(
    await validateJsonFiles(validateBookmarkFiles(project, definition.name))
  );
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return getBookmark(project, definition.name);
}

export async function updateBookmark(project, request) {
  const existing = getBookmark(project, request.bookmarkName);
  const updated = {
    ...existing,
    displayName: request.displayName ?? existing.displayName,
    options: request.options != null ? deepClone(request.options) : existing.options
  };

  if (request.pageName != null) {
    updated.explorationState = deepMerge(updated.explorationState || {}, {
      activeSection: request.pageName
    });
  }
  if (request.explorationState) {
    updated.explorationState = deepMerge(
      buildDefaultExplorationState(project, request.pageName || existing.explorationState?.activeSection),
      deepClone(request.explorationState)
    );
  }
  if (request.sections) {
    updated.explorationState.sections = deepMerge(
      updated.explorationState.sections || {},
      deepClone(request.sections)
    );
  }
  if (request.filters != null) {
    updated.explorationState.filters = deepClone(request.filters);
  }
  if (request.objects != null) {
    updated.explorationState.objects = deepClone(request.objects);
  }

  writeJson(bookmarkFile(project, request.bookmarkName), updated);

  if (request.groupName !== undefined) {
    const metadata = getBookmarksMetadata(project);
    addBookmarkToMetadata(metadata, request.bookmarkName, request.groupName || null);
    writeBookmarksMetadata(project, metadata);
  }

  const validation = summarizeValidationResults(
    await validateJsonFiles(validateBookmarkFiles(project, request.bookmarkName))
  );
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return getBookmark(project, request.bookmarkName);
}

export async function deleteBookmark(project, request) {
  const filePath = bookmarkFile(project, request.bookmarkName);
  ensureExists(fs.existsSync(filePath), `Bookmark not found: ${request.bookmarkName}`);
  fs.rmSync(filePath, { force: true });

  const metadata = getBookmarksMetadata(project);
  removeBookmarkFromMetadata(metadata, request.bookmarkName);
  writeBookmarksMetadata(project, metadata);

  const validation = summarizeValidationResults(
    await validateJsonFiles([bookmarksMetadataFile(project)])
  );
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return {
    deletedBookmarkName: request.bookmarkName,
    bookmarks: listBookmarks(project)
  };
}

export async function reorderBookmarks(project, request) {
  const metadata = getBookmarksMetadata(project);

  if (request.groupName) {
    const group = metadata.items.find((item) => isBookmarkGroup(item) && item.name === request.groupName);
    ensureExists(group, `Bookmark group not found: ${request.groupName}`);
    const currentChildren = new Set(group.children || []);
    for (const bookmarkName of request.bookmarkOrder || []) {
      ensureExists(currentChildren.has(bookmarkName), `Bookmark ${bookmarkName} is not in group ${request.groupName}`);
    }
    const remaining = [...currentChildren].filter(
      (bookmarkName) => !(request.bookmarkOrder || []).includes(bookmarkName)
    );
    group.children = [...(request.bookmarkOrder || []), ...remaining];
  }

  if (request.itemsOrder?.length) {
    const currentItems = metadata.items || [];
    const currentNames = new Set(currentItems.map((item) => item.name));
    for (const itemName of request.itemsOrder) {
      ensureExists(currentNames.has(itemName), `Unknown bookmark metadata item: ${itemName}`);
    }

    const remainder = currentItems.filter((item) => !request.itemsOrder.includes(item.name));
    metadata.items = [
      ...request.itemsOrder.map((itemName) => currentItems.find((item) => item.name === itemName)),
      ...remainder
    ];
  }

  writeBookmarksMetadata(project, metadata);

  const validation = summarizeValidationResults(
    await validateJsonFiles([bookmarksMetadataFile(project)])
  );
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return {
    metadata
  };
}

export async function createBookmarkGroup(project, request) {
  const metadata = getBookmarksMetadata(project);
  const name = createBookmarkGroupName(request.groupName || request.displayName);
  ensureExists(
    !metadata.items.some((item) => item.name === name),
    `Bookmark group already exists: ${name}`
  );

  metadata.items.push({
    name,
    displayName: request.displayName || name,
    children: []
  });
  writeBookmarksMetadata(project, metadata);

  const validation = summarizeValidationResults(
    await validateJsonFiles([bookmarksMetadataFile(project)])
  );
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return getBookmarkGroup(project, name);
}

export async function updateBookmarkGroup(project, request) {
  const metadata = getBookmarksMetadata(project);
  const group = metadata.items.find((item) => isBookmarkGroup(item) && item.name === request.groupName);
  ensureExists(group, `Bookmark group not found: ${request.groupName}`);
  if (request.displayName != null) {
    group.displayName = request.displayName;
  }
  if (request.bookmarkOrder) {
    const currentChildren = new Set(group.children || []);
    for (const childName of request.bookmarkOrder) {
      ensureExists(currentChildren.has(childName), `Bookmark ${childName} is not in group ${request.groupName}`);
    }
    const remaining = [...currentChildren].filter((childName) => !request.bookmarkOrder.includes(childName));
    group.children = [...request.bookmarkOrder, ...remaining];
  }
  writeBookmarksMetadata(project, metadata);

  const validation = summarizeValidationResults(
    await validateJsonFiles([bookmarksMetadataFile(project)])
  );
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return group;
}

export async function deleteBookmarkGroup(project, request) {
  const metadata = getBookmarksMetadata(project);
  const group = metadata.items.find((item) => isBookmarkGroup(item) && item.name === request.groupName);
  ensureExists(group, `Bookmark group not found: ${request.groupName}`);

  const orphanChildren = [...(group.children || [])];
  metadata.items = metadata.items.filter((item) => item.name !== request.groupName);
  for (const childName of orphanChildren) {
    metadata.items.push({ name: childName });
  }
  writeBookmarksMetadata(project, metadata);

  const validation = summarizeValidationResults(
    await validateJsonFiles([bookmarksMetadataFile(project)])
  );
  if (!validation.valid) {
    throw new Error(JSON.stringify(validation.invalidFiles, null, 2));
  }

  return {
    deletedGroupName: request.groupName,
    bookmarks: listBookmarks(project)
  };
}

export function openBookmarkProject(projectPath) {
  return openProject(projectPath);
}
