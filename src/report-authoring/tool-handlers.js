import { SCHEMA_URLS } from "./constants.js";
import {
  createBlankProjectFixture,
  createPage,
  deletePage,
  duplicatePage,
  getPage,
  getProjectSummary,
  listPages,
  openProject,
  reorderPages,
  updatePage,
  validateProject
} from "./project-service.js";
import {
  bindVisualFields,
  createVisual,
  deleteVisual,
  duplicateVisual,
  getVisual,
  listVisuals,
  moveVisual,
  setVisualFormatting,
  updateVisual
} from "./visual-service.js";

let currentProjectPath = null;

function getProjectFromRequest(request) {
  const projectPath = request.projectPath || currentProjectPath;
  if (!projectPath) {
    throw new Error("No report project is open. Call OpenProject first or pass projectPath.");
  }

  return openProject(projectPath);
}

export async function handleProjectOperation(request) {
  switch (request.operation) {
    case "OpenProject": {
      const project = openProject(request.projectPath);
      currentProjectPath = project.root;
      return {
        success: true,
        operation: "OpenProject",
        project: getProjectSummary(project)
      };
    }
    case "GetProject": {
      const project = getProjectFromRequest(request);
      return {
        success: true,
        operation: "GetProject",
        project: getProjectSummary(project)
      };
    }
    case "ValidateProject": {
      const project = getProjectFromRequest(request);
      return {
        success: true,
        operation: "ValidateProject",
        validation: await validateProject(project)
      };
    }
    case "ListSchemas":
      return {
        success: true,
        operation: "ListSchemas",
        schemas: SCHEMA_URLS
      };
    default:
      throw new Error(`Unsupported project operation: ${request.operation}`);
  }
}

export async function handlePageOperation(request) {
  const project = getProjectFromRequest(request);
  switch (request.operation) {
    case "List":
      return { success: true, operation: "List", pages: listPages(project) };
    case "Get":
      return { success: true, operation: "Get", page: getPage(project, request.pageName) };
    case "Create":
      return { success: true, operation: "Create", page: await createPage(project, request) };
    case "Update":
      return { success: true, operation: "Update", page: await updatePage(project, request) };
    case "Delete":
      return { success: true, operation: "Delete", ...await deletePage(project, request) };
    case "Reorder":
      return { success: true, operation: "Reorder", ...await reorderPages(project, request) };
    case "Duplicate":
      return { success: true, operation: "Duplicate", page: await duplicatePage(project, request) };
    default:
      throw new Error(`Unsupported page operation: ${request.operation}`);
  }
}

export async function handleVisualOperation(request) {
  const project = getProjectFromRequest(request);
  switch (request.operation) {
    case "List":
      return { success: true, operation: "List", visuals: listVisuals(project, request.pageName) };
    case "Get":
      return { success: true, operation: "Get", visual: getVisual(project, request.pageName, request.visualName) };
    case "Create":
      return { success: true, operation: "Create", visual: await createVisual(project, request) };
    case "Update":
      return { success: true, operation: "Update", visual: await updateVisual(project, request) };
    case "Delete":
      return { success: true, operation: "Delete", ...await deleteVisual(project, request) };
    case "Duplicate":
      return { success: true, operation: "Duplicate", visual: await duplicateVisual(project, request) };
    case "Move":
      return { success: true, operation: "Move", visual: await moveVisual(project, request) };
    case "BindFields":
      return { success: true, operation: "BindFields", visual: await bindVisualFields(project, request) };
    case "SetFormatting":
      return { success: true, operation: "SetFormatting", visual: await setVisualFormatting(project, request) };
    default:
      throw new Error(`Unsupported visual operation: ${request.operation}`);
  }
}

export { createBlankProjectFixture };
