import fs from "node:fs";

import { SCHEMA_URLS } from "./constants.js";
import { createGroupName } from "./ids.js";
import { getAnnotation } from "./format-utils.js";
import {
  getPage,
  listPageNames,
  listVisualNames,
  visualDir
} from "./project-service.js";
import { getVisual, normalizeLayout, saveVisualDefinition } from "./visual-service.js";

function ensureExists(value, message) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

function isGroupDefinition(definition) {
  return Boolean(definition?.visualGroup);
}

function listContainers(project, pageName) {
  return listVisualNames(project, pageName).map((visualName) => getVisual(project, pageName, visualName));
}

function getContainer(project, pageName, name) {
  return getVisual(project, pageName, name);
}

function getGroupDefinition(project, pageName, groupName) {
  const definition = getContainer(project, pageName, groupName);
  ensureExists(isGroupDefinition(definition), `Visual group not found: ${pageName}/${groupName}`);
  return definition;
}

function getDirectChildren(project, pageName, groupName) {
  return listContainers(project, pageName).filter((definition) => definition.parentGroupName === groupName);
}

function getDescendantNames(project, pageName, rootName) {
  const all = listContainers(project, pageName);
  const byParent = new Map();
  for (const definition of all) {
    if (!definition.parentGroupName) {
      continue;
    }
    const siblings = byParent.get(definition.parentGroupName) || [];
    siblings.push(definition.name);
    byParent.set(definition.parentGroupName, siblings);
  }

  const names = [];
  const stack = [...(byParent.get(rootName) || [])];
  while (stack.length) {
    const current = stack.pop();
    names.push(current);
    stack.push(...(byParent.get(current) || []));
  }

  return names;
}

function getAncestorGroupNames(project, pageName, name) {
  const ancestors = [];
  let currentName = name;
  while (true) {
    const definition = getContainer(project, pageName, currentName);
    if (!definition.parentGroupName) {
      break;
    }
    ancestors.push(definition.parentGroupName);
    currentName = definition.parentGroupName;
  }
  return ancestors;
}

function ensureNoParentCycle(project, pageName, groupName, parentGroupName) {
  if (!parentGroupName) {
    return;
  }

  ensureExists(groupName !== parentGroupName, "A group cannot be parented to itself.");
  const descendants = new Set(getDescendantNames(project, pageName, groupName));
  ensureExists(
    !descendants.has(parentGroupName),
    `Cannot move ${groupName} into descendant group ${parentGroupName}.`
  );
}

function computeBounds(definitions) {
  ensureExists(definitions.length, "At least one visual or group is required.");
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;

  for (const definition of definitions) {
    const position = definition.position || {};
    minX = Math.min(minX, position.x ?? 0);
    minY = Math.min(minY, position.y ?? 0);
    maxRight = Math.max(maxRight, (position.x ?? 0) + (position.width ?? 0));
    maxBottom = Math.max(maxBottom, (position.y ?? 0) + (position.height ?? 0));
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxRight - minX),
    height: Math.max(0, maxBottom - minY)
  };
}

function summarizeGroup(project, pageName, definition) {
  const children = getDirectChildren(project, pageName, definition.name);
  return {
    name: definition.name,
    pageName,
    displayName: definition.visualGroup.displayName,
    groupMode: definition.visualGroup.groupMode,
    parentGroupName: definition.parentGroupName || null,
    hidden: Boolean(definition.isHidden),
    position: definition.position,
    childNames: children.map((child) => child.name)
  };
}

async function updateDefinitions(project, pageName, definitions) {
  const saved = [];
  for (const definition of definitions) {
    saved.push(await saveVisualDefinition(project, pageName, definition));
  }
  return saved;
}

function getSelectedDefinitions(project, request, { includeGroupChildren = false } = {}) {
  ensureExists(request.pageName, "pageName is required.");

  if (request.visualNames?.length) {
    return request.visualNames.map((name) => getContainer(project, request.pageName, name));
  }

  if (request.visualName) {
    return [getContainer(project, request.pageName, request.visualName)];
  }

  if (request.groupName) {
    return includeGroupChildren
      ? getDirectChildren(project, request.pageName, request.groupName)
      : [getGroupDefinition(project, request.pageName, request.groupName)];
  }

  throw new Error("visualName, visualNames, or groupName is required.");
}

function getRootSelectionNames(project, pageName, definitions) {
  const selected = new Set(definitions.map((definition) => definition.name));
  return definitions
    .map((definition) => definition.name)
    .filter((name) => getAncestorGroupNames(project, pageName, name).every((ancestor) => !selected.has(ancestor)));
}

async function translateSelection(project, pageName, rootNames, deltaByRoot) {
  const namesToMove = new Map();
  for (const rootName of rootNames) {
    const delta = deltaByRoot.get(rootName);
    namesToMove.set(rootName, delta);
    for (const childName of getDescendantNames(project, pageName, rootName)) {
      namesToMove.set(childName, delta);
    }
  }

  const updated = [];
  for (const [name, delta] of namesToMove.entries()) {
    const definition = getContainer(project, pageName, name);
    definition.position = {
      ...definition.position,
      x: (definition.position?.x ?? 0) + delta.dx,
      y: (definition.position?.y ?? 0) + delta.dy
    };
    updated.push(definition);
  }

  return updateDefinitions(project, pageName, updated);
}

async function recomputeGroupBounds(project, pageName, groupName) {
  const definition = getGroupDefinition(project, pageName, groupName);
  const children = getDirectChildren(project, pageName, groupName);
  if (!children.length) {
    return definition;
  }

  definition.position = normalizeLayout(computeBounds(children), definition.position);
  return saveVisualDefinition(project, pageName, definition);
}

async function recomputeAffectedGroups(project, pageName, names) {
  const groups = new Set();
  for (const name of names) {
    try {
      const definition = getContainer(project, pageName, name);
      if (definition.parentGroupName) {
        groups.add(definition.parentGroupName);
      }
      if (isGroupDefinition(definition)) {
        groups.add(definition.name);
      }
      for (const ancestor of getAncestorGroupNames(project, pageName, name)) {
        groups.add(ancestor);
      }
    } catch {
      // Ignore deleted visuals/groups.
    }
  }

  const summaries = [];
  for (const groupName of groups) {
    summaries.push(await recomputeGroupBounds(project, pageName, groupName));
  }
  return summaries;
}

function normalizeVisibility(value) {
  ensureExists(typeof value === "boolean", "visibility must be a boolean.");
  return value;
}

function normalizeLayerAction(value) {
  switch (String(value || "BringToFront").toLowerCase()) {
    case "sendtoback":
    case "back":
      return "SendToBack";
    case "bringforward":
    case "forward":
      return "BringForward";
    case "sendbackward":
    case "backward":
      return "SendBackward";
    default:
      return "BringToFront";
  }
}

function reorderPageDefinitions(definitions, targetNames, layerAction) {
  const targets = definitions.filter((definition) => targetNames.has(definition.name));
  const remainder = definitions.filter((definition) => !targetNames.has(definition.name));

  if (layerAction === "SendToBack") {
    return [...targets, ...remainder];
  }

  if (layerAction === "BringForward" || layerAction === "SendBackward") {
    const ordered = [...definitions];
    const direction = layerAction === "BringForward" ? 1 : -1;
    const indexes = ordered
      .map((definition, index) => ({ definition, index }))
      .filter(({ definition }) => targetNames.has(definition.name))
      .map(({ index }) => index);

    const iteration = direction > 0 ? [...indexes].reverse() : indexes;
    for (const index of iteration) {
      const swapIndex = index + direction;
      if (swapIndex < 0 || swapIndex >= ordered.length) {
        continue;
      }
      const current = ordered[index];
      const next = ordered[swapIndex];
      if (targetNames.has(next.name) === targetNames.has(current.name)) {
        continue;
      }
      ordered[index] = next;
      ordered[swapIndex] = current;
    }
    return ordered;
  }

  return [...remainder, ...targets];
}

async function normalizePageLayers(project, pageName, orderedNames = null) {
  const definitions = orderedNames
    ? orderedNames.map((name) => getContainer(project, pageName, name))
    : listContainers(project, pageName).sort(
        (left, right) =>
          (left.position?.z ?? 0) - (right.position?.z ?? 0) ||
          (left.position?.tabOrder ?? 0) - (right.position?.tabOrder ?? 0) ||
          left.name.localeCompare(right.name)
      );

  for (const [index, definition] of definitions.entries()) {
    definition.position = {
      ...definition.position,
      z: index,
      tabOrder: index
    };
  }

  return updateDefinitions(project, pageName, definitions);
}

export function listGroups(project, request = {}) {
  const pageNames = request.pageName ? [request.pageName] : listPageNames(project);
  return pageNames.flatMap((pageName) =>
    listContainers(project, pageName)
      .filter((definition) => isGroupDefinition(definition))
      .map((definition) => summarizeGroup(project, pageName, definition))
  );
}

export function getGroup(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.groupName, "groupName is required.");
  return summarizeGroup(project, request.pageName, getGroupDefinition(project, request.pageName, request.groupName));
}

export async function createGroup(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  const page = getPage(project, request.pageName);
  ensureExists(page, `Page not found: ${request.pageName}`);

  const name = createGroupName(request.groupName || request.displayName);
  ensureExists(
    !listVisualNames(project, request.pageName).includes(name),
    `A visual or group with this name already exists: ${name}`
  );

  if (request.parentGroupName) {
    getGroupDefinition(project, request.pageName, request.parentGroupName);
  }

  const memberDefinitions = (request.visualNames || []).map((visualName) => getContainer(project, request.pageName, visualName));
  for (const member of memberDefinitions) {
    ensureExists(member.name !== name, "A group cannot contain itself.");
  }

  const inferredLayout = memberDefinitions.length
    ? computeBounds(memberDefinitions)
    : {
        x: 0,
        y: 0,
        width: 320,
        height: 180
      };

  const groupDefinition = {
    $schema: SCHEMA_URLS.visual,
    name,
    position: normalizeLayout(request.layout || inferredLayout, {
      x: inferredLayout.x,
      y: inferredLayout.y,
      z: request.layout?.z ?? 0,
      width: inferredLayout.width,
      height: inferredLayout.height,
      tabOrder: request.layout?.tabOrder ?? request.layout?.z ?? 0
    }),
    visualGroup: {
      displayName: request.displayName || name,
      groupMode: request.groupMode || "ScaleMode"
    }
  };
  if (request.parentGroupName) {
    groupDefinition.parentGroupName = request.parentGroupName;
  }
  if (request.visibility != null) {
    groupDefinition.isHidden = !normalizeVisibility(request.visibility);
  }

  await saveVisualDefinition(project, request.pageName, groupDefinition);

  if (memberDefinitions.length) {
    for (const memberDefinition of memberDefinitions) {
      if (isGroupDefinition(memberDefinition)) {
        ensureNoParentCycle(project, request.pageName, memberDefinition.name, name);
      }
      memberDefinition.parentGroupName = name;
    }
    await updateDefinitions(project, request.pageName, memberDefinitions);
    await recomputeAffectedGroups(project, request.pageName, [name, ...memberDefinitions.map((definition) => definition.name)]);
  }

  return getGroup(project, { pageName: request.pageName, groupName: name });
}

export async function updateGroup(project, request) {
  const definition = getGroupDefinition(project, request.pageName, request.groupName);

  if (request.displayName != null) {
    definition.visualGroup.displayName = request.displayName;
  }
  if (request.groupMode != null) {
    definition.visualGroup.groupMode = request.groupMode;
  }
  if (request.layout) {
    definition.position = normalizeLayout(request.layout, definition.position);
  }
  if (request.visibility != null) {
    definition.isHidden = !normalizeVisibility(request.visibility);
  }
  if (request.parentGroupName !== undefined) {
    if (request.parentGroupName) {
      getGroupDefinition(project, request.pageName, request.parentGroupName);
      ensureNoParentCycle(project, request.pageName, definition.name, request.parentGroupName);
      definition.parentGroupName = request.parentGroupName;
    } else {
      delete definition.parentGroupName;
    }
  }

  await saveVisualDefinition(project, request.pageName, definition);
  await recomputeAffectedGroups(project, request.pageName, [definition.name]);
  return getGroup(project, request);
}

export async function deleteGroup(project, request) {
  const definition = getGroupDefinition(project, request.pageName, request.groupName);
  const children = getDirectChildren(project, request.pageName, request.groupName);
  const promotedParentName = definition.parentGroupName || null;

  for (const child of children) {
    if (promotedParentName) {
      if (isGroupDefinition(child)) {
        ensureNoParentCycle(project, request.pageName, child.name, promotedParentName);
      }
      child.parentGroupName = promotedParentName;
    } else {
      delete child.parentGroupName;
    }
  }

  if (children.length) {
    await updateDefinitions(project, request.pageName, children);
  }
  fs.rmSync(visualDir(project, request.pageName, request.groupName), {
    recursive: true,
    force: true
  });

  await recomputeAffectedGroups(project, request.pageName, [
    request.groupName,
    ...children.map((child) => child.name),
    ...(promotedParentName ? [promotedParentName] : [])
  ]);

  return {
    deletedGroupName: request.groupName,
    groups: listGroups(project, { pageName: request.pageName })
  };
}

export async function addToGroup(project, request) {
  ensureExists(request.visualNames?.length, "visualNames are required.");
  const targetGroup = getGroupDefinition(project, request.pageName, request.groupName);
  const updated = [];
  const affectedNames = [targetGroup.name];

  for (const visualName of request.visualNames) {
    const definition = getContainer(project, request.pageName, visualName);
    if (isGroupDefinition(definition)) {
      ensureNoParentCycle(project, request.pageName, definition.name, targetGroup.name);
    }
    if (definition.parentGroupName) {
      affectedNames.push(definition.parentGroupName);
    }
    definition.parentGroupName = targetGroup.name;
    updated.push(definition);
    affectedNames.push(definition.name);
  }

  await updateDefinitions(project, request.pageName, updated);
  await recomputeAffectedGroups(project, request.pageName, affectedNames);
  return getGroup(project, request);
}

export async function removeFromGroup(project, request) {
  ensureExists(request.groupName, "groupName is required.");
  const group = getGroupDefinition(project, request.pageName, request.groupName);
  const definitions = request.visualNames?.length
    ? request.visualNames.map((visualName) => getContainer(project, request.pageName, visualName))
    : getDirectChildren(project, request.pageName, request.groupName);

  for (const definition of definitions) {
    ensureExists(
      definition.parentGroupName === group.name,
      `${definition.name} is not a direct child of group ${group.name}.`
    );
    delete definition.parentGroupName;
  }

  await updateDefinitions(project, request.pageName, definitions);
  await recomputeAffectedGroups(project, request.pageName, [group.name, ...definitions.map((definition) => definition.name)]);
  return getGroup(project, request);
}

export async function ungroup(project, request) {
  return deleteGroup(project, request);
}

export async function setVisibility(project, request) {
  const visibility = normalizeVisibility(request.visibility);
  const definitions = getSelectedDefinitions(project, request);
  for (const definition of definitions) {
    definition.isHidden = !visibility;
  }
  const saved = await updateDefinitions(project, request.pageName, definitions);
  return {
    visibility,
    visuals: saved.map((definition) => ({
      name: definition.name,
      hidden: Boolean(definition.isHidden)
    }))
  };
}

export async function setLayerOrder(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  const layerAction = normalizeLayerAction(request.layerAction);
  const targetDefinitions = getSelectedDefinitions(project, request);
  const targetNames = new Set(targetDefinitions.map((definition) => definition.name));
  const currentOrder = listContainers(project, request.pageName).sort(
    (left, right) =>
      (left.position?.z ?? 0) - (right.position?.z ?? 0) ||
      (left.position?.tabOrder ?? 0) - (right.position?.tabOrder ?? 0) ||
      left.name.localeCompare(right.name)
  );
  const nextOrder = reorderPageDefinitions(currentOrder, targetNames, layerAction);
  const saved = await normalizePageLayers(
    project,
    request.pageName,
    nextOrder.map((definition) => definition.name)
  );

  return {
    layerAction,
    visuals: saved.map((definition) => ({
      name: definition.name,
      z: definition.position?.z ?? 0,
      tabOrder: definition.position?.tabOrder ?? 0
    }))
  };
}

function normalizeAlignment(value) {
  switch (String(value || "left").toLowerCase()) {
    case "center":
      return "center";
    case "right":
      return "right";
    case "top":
      return "top";
    case "middle":
      return "middle";
    case "bottom":
      return "bottom";
    default:
      return "left";
  }
}

export async function align(project, request) {
  const alignment = normalizeAlignment(request.alignment);
  const selected = getSelectedDefinitions(project, request, { includeGroupChildren: true });
  ensureExists(selected.length >= 2, "At least two visuals or groups are required for alignment.");

  const rootNames = getRootSelectionNames(project, request.pageName, selected);
  const rootDefinitions = rootNames.map((name) => getContainer(project, request.pageName, name));
  const bounds = computeBounds(rootDefinitions);
  const deltaByRoot = new Map();

  for (const definition of rootDefinitions) {
    let dx = 0;
    let dy = 0;
    const position = definition.position;
    switch (alignment) {
      case "center":
        dx = bounds.x + bounds.width / 2 - (position.x + position.width / 2);
        break;
      case "right":
        dx = bounds.x + bounds.width - (position.x + position.width);
        break;
      case "top":
        dy = bounds.y - position.y;
        break;
      case "middle":
        dy = bounds.y + bounds.height / 2 - (position.y + position.height / 2);
        break;
      case "bottom":
        dy = bounds.y + bounds.height - (position.y + position.height);
        break;
      default:
        dx = bounds.x - position.x;
        break;
    }
    deltaByRoot.set(definition.name, { dx, dy });
  }

  const visuals = await translateSelection(project, request.pageName, rootNames, deltaByRoot);
  await recomputeAffectedGroups(project, request.pageName, rootNames);
  return {
    alignment,
    visuals: visuals.map((definition) => ({
      name: definition.name,
      position: definition.position
    }))
  };
}

function normalizeDistribution(value) {
  return String(value || "horizontal").toLowerCase() === "vertical" ? "vertical" : "horizontal";
}

export async function distribute(project, request) {
  const distribution = normalizeDistribution(request.distribution);
  const selected = getSelectedDefinitions(project, request, { includeGroupChildren: true });
  ensureExists(selected.length >= 3, "At least three visuals or groups are required for distribution.");

  const rootNames = getRootSelectionNames(project, request.pageName, selected);
  const rootDefinitions = rootNames.map((name) => getContainer(project, request.pageName, name));
  const ordered = [...rootDefinitions].sort((left, right) =>
    distribution === "vertical"
      ? (left.position?.y ?? 0) - (right.position?.y ?? 0)
      : (left.position?.x ?? 0) - (right.position?.x ?? 0)
  );

  const first = ordered[0].position;
  const last = ordered[ordered.length - 1].position;
  const totalSize = ordered.reduce(
    (sum, definition) => sum + (distribution === "vertical" ? definition.position.height : definition.position.width),
    0
  );
  const span =
    distribution === "vertical"
      ? last.y + last.height - first.y
      : last.x + last.width - first.x;
  const gap = ordered.length > 1 ? Math.max(0, (span - totalSize) / (ordered.length - 1)) : 0;

  const deltaByRoot = new Map();
  let cursor = distribution === "vertical" ? first.y : first.x;
  for (const definition of ordered) {
    const current = distribution === "vertical" ? definition.position.y : definition.position.x;
    const delta = cursor - current;
    deltaByRoot.set(definition.name, {
      dx: distribution === "vertical" ? 0 : delta,
      dy: distribution === "vertical" ? delta : 0
    });
    cursor += (distribution === "vertical" ? definition.position.height : definition.position.width) + gap;
  }

  const visuals = await translateSelection(project, request.pageName, rootNames, deltaByRoot);
  await recomputeAffectedGroups(project, request.pageName, rootNames);
  return {
    distribution,
    visuals: visuals.map((definition) => ({
      name: definition.name,
      position: definition.position
    }))
  };
}

export async function resizeToFit(project, request) {
  ensureExists(request.pageName, "pageName is required.");
  ensureExists(request.groupName, "groupName is required.");
  const group = await recomputeGroupBounds(project, request.pageName, request.groupName);
  await recomputeAffectedGroups(project, request.pageName, [group.name]);
  return summarizeGroup(project, request.pageName, getGroupDefinition(project, request.pageName, request.groupName));
}

export function isManagedInteractiveControl(definition) {
  return Boolean(getAnnotation(definition, "codex.controlType"));
}
