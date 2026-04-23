import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { getProjectFiles, openProject } from "./project-service.js";

function hashFile(filePath) {
  return crypto.createHash("sha1").update(fs.readFileSync(filePath)).digest("hex");
}

function emptyBuckets() {
  return {
    pages: [],
    visuals: [],
    bookmarks: [],
    groups: [],
    controls: [],
    fieldParameters: [],
    mobileLayouts: []
  };
}

export function snapshotProjectFiles(projectPath) {
  const project = openProject(projectPath);
  const files = new Map();

  for (const filePath of getProjectFiles(project)) {
    if (fs.existsSync(filePath)) {
      files.set(filePath, hashFile(filePath));
    }
  }

  return files;
}

export function diffProjectFiles(projectPath, beforeSnapshot) {
  const afterSnapshot = snapshotProjectFiles(projectPath);
  const changed = new Set();

  for (const [filePath, hash] of beforeSnapshot.entries()) {
    if (!afterSnapshot.has(filePath) || afterSnapshot.get(filePath) !== hash) {
      changed.add(filePath);
    }
  }

  for (const filePath of afterSnapshot.keys()) {
    if (!beforeSnapshot.has(filePath)) {
      changed.add(filePath);
    }
  }

  return [...changed].sort().map((filePath) => path.relative(projectPath, filePath));
}

function uniq(values) {
  return [...new Set(values.filter(Boolean))];
}

export function buildEntityChanges(kind, operation, request, result) {
  const created = emptyBuckets();
  const updated = emptyBuckets();
  const deleted = emptyBuckets();

  switch (kind) {
    case "page":
      if (operation === "Create" || operation === "Duplicate") {
        created.pages = uniq([result.page?.name, request.targetPageName, request.pageName]);
      } else if (operation === "Delete") {
        deleted.pages = uniq([request.pageName]);
      } else if (operation === "Reorder") {
        updated.pages = uniq(result.pageOrder || request.pageOrder || []);
      } else {
        updated.pages = uniq([request.pageName]);
      }
      break;
    case "visual":
      if (operation === "Create" || operation === "Duplicate") {
        created.visuals = uniq([result.visual?.name, request.name, request.visualName]);
      } else if (operation === "Delete") {
        deleted.visuals = uniq([request.visualName]);
      } else {
        updated.visuals = uniq([result.visual?.name, request.visualName, request.name]);
      }
      break;
    case "bookmark":
      if (operation === "Create" || operation === "CreateGroup") {
        created.bookmarks = uniq([result.bookmark?.name, result.group?.name, request.bookmarkName, request.groupName]);
      } else if (operation === "Delete" || operation === "DeleteGroup") {
        deleted.bookmarks = uniq([request.bookmarkName, request.groupName]);
      } else {
        updated.bookmarks = uniq([result.bookmark?.name, result.group?.name, request.bookmarkName, request.groupName]);
      }
      break;
    case "interaction":
      if (operation.startsWith("Create")) {
        created.controls = uniq([result.controlName, request.controlName]);
        created.visuals = uniq([
          result.control?.name,
          ...(result.control?.visuals || []).map((visual) => visual.name),
          ...(result.control?.visual ? [result.control.visual.name] : [])
        ]);
      } else {
        updated.controls = uniq([request.controlName]);
        updated.pages = uniq([request.pageName, request.tooltipPageName, request.drillthroughPageName]);
        updated.visuals = uniq([request.visualName, request.sourceVisualName, request.targetVisualName]);
      }
      break;
    case "composition":
      if (operation === "CreateGroup") {
        created.groups = uniq([result.group?.name, request.groupName]);
      } else if (operation === "DeleteGroup" || operation === "Ungroup") {
        deleted.groups = uniq([request.groupName]);
      } else {
        updated.groups = uniq([result.group?.name, request.groupName]);
      }
      break;
    case "fieldParameter":
      if (operation === "Create") {
        created.fieldParameters = uniq([result.fieldParameter?.name, request.parameterName]);
      } else if (operation === "Delete") {
        deleted.fieldParameters = uniq([request.parameterName]);
      } else {
        updated.fieldParameters = uniq([result.fieldParameter?.name, request.parameterName]);
        updated.visuals = uniq([request.visualName, result.visual?.name, result.slicer?.name]);
      }
      break;
    case "mobileLayout":
      updated.mobileLayouts = uniq([request.visualName || request.pageName]);
      break;
    case "template":
      created.pages = uniq([result.page?.name]);
      created.visuals = uniq((result.visuals || []).map((visual) => visual.name));
      created.controls = uniq((result.controls || []).map((control) => control.name || control.controlName));
      updated.visuals = uniq((result.updatedVisuals || []).map((visual) => visual.name));
      break;
    default:
      break;
  }

  return { created, updated, deleted };
}

export function withChangeSummary(result, files, entityChanges, warnings = []) {
  return {
    ...result,
    changes: {
      files,
      ...entityChanges,
      warnings
    }
  };
}
