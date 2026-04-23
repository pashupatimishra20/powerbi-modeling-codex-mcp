import {
  SCHEMA_URLS,
  SUPPORTED_CONTROL_TYPES,
  SUPPORTED_VISUAL_TYPES
} from "./constants.js";
import {
  buildEntityChanges,
  diffProjectFiles,
  snapshotProjectFiles,
  withChangeSummary
} from "./change-summary.js";
import {
  addToGroup,
  align,
  createGroup,
  deleteGroup,
  distribute,
  getGroup,
  listGroups,
  removeFromGroup,
  resizeToFit,
  setLayerOrder,
  setVisibility,
  ungroup,
  updateGroup
} from "./composition-service.js";
import {
  createBookmark,
  createBookmarkGroup,
  deleteBookmark,
  deleteBookmarkGroup,
  getBookmark,
  listBookmarks,
  reorderBookmarks,
  updateBookmark,
  updateBookmarkGroup
} from "./bookmark-service.js";
import {
  bindFieldParameterToVisual,
  createFieldParameter,
  createFieldParameterSlicer,
  deleteFieldParameter,
  listFieldParameters,
  updateFieldParameter
} from "./field-parameter-service.js";
import {
  clearDrillthroughPage,
  clearCrossReportDrillthroughPage,
  clearTooltipPage,
  configureTooltipPage,
  configureCrossReportDrillthroughPage,
  configureDrillthroughPage,
  assignTooltip,
  createControl,
  setVisualInteractions,
  setSlicerSync,
  updateControl
} from "./interaction-service.js";
import {
  autoCreateMobileLayout,
  clearMobileLayout,
  getMobileLayout,
  listMobileLayouts,
  placeMobileVisual,
  removeMobileVisual,
  updateMobileVisual
} from "./mobile-layout-service.js";
import {
  applyVisualStylePreset,
  createFilterBar,
  createKpiStrip,
  createPageFromTemplate,
  createTooltipLayout,
  listTemplates
} from "./template-service.js";
import {
  createBlankProjectFixture,
  createPage,
  deletePage,
  duplicatePage,
  getPageContext,
  getPage,
  getProjectContext,
  getProjectSummary,
  listPages,
  openProject,
  reorderPages,
  searchBindableFields,
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

async function runWithChanges(request, kind, operation, execute) {
  const project = getProjectFromRequest(request);
  const before = snapshotProjectFiles(project.root);
  const result = await execute(project);
  const files = diffProjectFiles(project.root, before);
  const entityChanges = buildEntityChanges(kind, operation, request, result);
  return withChangeSummary(result, files, entityChanges);
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
    case "GetProjectContext": {
      const project = getProjectFromRequest(request);
      return {
        success: true,
        operation: "GetProjectContext",
        context: getProjectContext(project)
      };
    }
    case "SearchBindableFields": {
      const project = getProjectFromRequest(request);
      return {
        success: true,
        operation: "SearchBindableFields",
        fields: searchBindableFields(project, request.search, request.limit)
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
    case "GetPageContext":
      return {
        success: true,
        operation: "GetPageContext",
        context: getPageContext(project, request.pageName)
      };
    case "Create":
      return runWithChanges(request, "page", "Create", async () => ({
        success: true,
        operation: "Create",
        page: await createPage(project, request)
      }));
    case "Update":
      return runWithChanges(request, "page", "Update", async () => ({
        success: true,
        operation: "Update",
        page: await updatePage(project, request)
      }));
    case "Delete":
      return runWithChanges(request, "page", "Delete", async () => ({
        success: true,
        operation: "Delete",
        ...await deletePage(project, request)
      }));
    case "Reorder":
      return runWithChanges(request, "page", "Reorder", async () => ({
        success: true,
        operation: "Reorder",
        ...await reorderPages(project, request)
      }));
    case "Duplicate":
      return runWithChanges(request, "page", "Duplicate", async () => ({
        success: true,
        operation: "Duplicate",
        page: await duplicatePage(project, request)
      }));
    default:
      throw new Error(`Unsupported page operation: ${request.operation}`);
  }
}

export async function handleVisualOperation(request) {
  switch (request.operation) {
    case "ListSupportedVisuals":
      return {
        success: true,
        operation: "ListSupportedVisuals",
        visualTypes: SUPPORTED_VISUAL_TYPES
      };
  }

  const project = getProjectFromRequest(request);
  switch (request.operation) {
    case "List":
      return { success: true, operation: "List", visuals: listVisuals(project, request.pageName) };
    case "Get":
      return { success: true, operation: "Get", visual: getVisual(project, request.pageName, request.visualName) };
    case "Create":
      return runWithChanges(request, "visual", "Create", async () => ({
        success: true,
        operation: "Create",
        visual: await createVisual(project, request)
      }));
    case "Update":
      return runWithChanges(request, "visual", "Update", async () => ({
        success: true,
        operation: "Update",
        visual: await updateVisual(project, request)
      }));
    case "Delete":
      return runWithChanges(request, "visual", "Delete", async () => ({
        success: true,
        operation: "Delete",
        ...await deleteVisual(project, request)
      }));
    case "Duplicate":
      return runWithChanges(request, "visual", "Duplicate", async () => ({
        success: true,
        operation: "Duplicate",
        visual: await duplicateVisual(project, request)
      }));
    case "Move":
      return runWithChanges(request, "visual", "Move", async () => ({
        success: true,
        operation: "Move",
        visual: await moveVisual(project, request)
      }));
    case "BindFields":
      return runWithChanges(request, "visual", "BindFields", async () => ({
        success: true,
        operation: "BindFields",
        visual: await bindVisualFields(project, request)
      }));
    case "SetFormatting":
      return runWithChanges(request, "visual", "SetFormatting", async () => ({
        success: true,
        operation: "SetFormatting",
        visual: await setVisualFormatting(project, request)
      }));
    default:
      throw new Error(`Unsupported visual operation: ${request.operation}`);
  }
}

export async function handleBookmarkOperation(request) {
  const project = getProjectFromRequest(request);
  switch (request.operation) {
    case "List":
      return { success: true, operation: "List", bookmarks: listBookmarks(project) };
    case "Get":
      return { success: true, operation: "Get", bookmark: getBookmark(project, request.bookmarkName) };
    case "Create":
      return { success: true, operation: "Create", bookmark: await createBookmark(project, request) };
    case "Update":
      return { success: true, operation: "Update", bookmark: await updateBookmark(project, request) };
    case "Delete":
      return { success: true, operation: "Delete", ...await deleteBookmark(project, request) };
    case "Reorder":
      return { success: true, operation: "Reorder", ...await reorderBookmarks(project, request) };
    case "CreateGroup":
      return { success: true, operation: "CreateGroup", group: await createBookmarkGroup(project, request) };
    case "UpdateGroup":
      return { success: true, operation: "UpdateGroup", group: await updateBookmarkGroup(project, request) };
    case "DeleteGroup":
      return { success: true, operation: "DeleteGroup", ...await deleteBookmarkGroup(project, request) };
    default:
      throw new Error(`Unsupported bookmark operation: ${request.operation}`);
  }
}

export async function handleInteractionOperation(request) {
  switch (request.operation) {
    case "ListSupportedControls":
      return {
        success: true,
        operation: "ListSupportedControls",
        controlTypes: SUPPORTED_CONTROL_TYPES
      };
  }

  const project = getProjectFromRequest(request);
  switch (request.operation) {
    case "ConfigureDrillthroughPage":
      return runWithChanges(request, "interaction", "ConfigureDrillthroughPage", async () => ({
        success: true,
        operation: "ConfigureDrillthroughPage",
        result: await configureDrillthroughPage(project, request)
      }));
    case "ConfigureCrossReportDrillthroughPage":
      return runWithChanges(request, "interaction", "ConfigureCrossReportDrillthroughPage", async () => ({
        success: true,
        operation: "ConfigureCrossReportDrillthroughPage",
        result: await configureCrossReportDrillthroughPage(project, request)
      }));
    case "ClearDrillthroughPage":
      return runWithChanges(request, "interaction", "ClearDrillthroughPage", async () => ({
        success: true,
        operation: "ClearDrillthroughPage",
        page: await clearDrillthroughPage(project, request)
      }));
    case "ClearCrossReportDrillthroughPage":
      return runWithChanges(request, "interaction", "ClearCrossReportDrillthroughPage", async () => ({
        success: true,
        operation: "ClearCrossReportDrillthroughPage",
        page: await clearCrossReportDrillthroughPage(project, request)
      }));
    case "ConfigureTooltipPage":
      return runWithChanges(request, "interaction", "ConfigureTooltipPage", async () => ({
        success: true,
        operation: "ConfigureTooltipPage",
        page: await configureTooltipPage(project, request)
      }));
    case "ClearTooltipPage":
      return runWithChanges(request, "interaction", "ClearTooltipPage", async () => ({
        success: true,
        operation: "ClearTooltipPage",
        page: await clearTooltipPage(project, request)
      }));
    case "AssignTooltip":
      return runWithChanges(request, "interaction", "AssignTooltip", async () => ({
        success: true,
        operation: "AssignTooltip",
        visual: await assignTooltip(project, request)
      }));
    case "SetVisualInteractions":
      return runWithChanges(request, "interaction", "SetVisualInteractions", async () => ({
        success: true,
        operation: "SetVisualInteractions",
        result: await setVisualInteractions(project, request)
      }));
    case "SetSlicerSync":
      return runWithChanges(request, "interaction", "SetSlicerSync", async () => ({
        success: true,
        operation: "SetSlicerSync",
        visual: await setSlicerSync(project, request)
      }));
    case "CreatePageNavigationButton":
      return runWithChanges(request, "interaction", "CreatePageNavigationButton", async () => ({
        success: true,
        operation: "CreatePageNavigationButton",
        control: await createControl(project, {
          ...request,
          controlType: "pageNavigationButton"
        })
      }));
    case "CreatePageNavigator":
      return runWithChanges(request, "interaction", "CreatePageNavigator", async () => ({
        success: true,
        operation: "CreatePageNavigator",
        control: await createControl(project, {
          ...request,
          controlType: "pageNavigator"
        })
      }));
    case "CreateSlicerActionButton":
      return runWithChanges(request, "interaction", "CreateSlicerActionButton", async () => ({
        success: true,
        operation: "CreateSlicerActionButton",
        control: await createControl(project, {
          ...request,
          controlType:
            request.slicerAction === "ClearAllSlicers"
              ? "clearAllSlicersButton"
              : "applyAllSlicersButton"
        })
      }));
    case "CreateWebUrlButton":
      return runWithChanges(request, "interaction", "CreateWebUrlButton", async () => ({
        success: true,
        operation: "CreateWebUrlButton",
        control: await createControl(project, {
          ...request,
          controlType: "webUrlButton"
        })
      }));
    case "CreateQnaButton":
      return runWithChanges(request, "interaction", "CreateQnaButton", async () => ({
        success: true,
        operation: "CreateQnaButton",
        control: await createControl(project, {
          ...request,
          controlType: "qnaButton"
        })
      }));
    case "CreateControl":
      return runWithChanges(request, "interaction", "CreateControl", async () => ({
        success: true,
        operation: "CreateControl",
        control: await createControl(project, request)
      }));
    case "UpdateControl":
      return runWithChanges(request, "interaction", "UpdateControl", async () => ({
        success: true,
        operation: "UpdateControl",
        control: await updateControl(project, request)
      }));
    default:
      throw new Error(`Unsupported interaction operation: ${request.operation}`);
  }
}

export async function handleCompositionOperation(request) {
  const project = getProjectFromRequest(request);
  switch (request.operation) {
    case "ListGroups":
      return { success: true, operation: "ListGroups", groups: listGroups(project, request) };
    case "GetGroup":
      return { success: true, operation: "GetGroup", group: getGroup(project, request) };
    case "CreateGroup":
      return { success: true, operation: "CreateGroup", group: await createGroup(project, request) };
    case "UpdateGroup":
      return { success: true, operation: "UpdateGroup", group: await updateGroup(project, request) };
    case "DeleteGroup":
      return { success: true, operation: "DeleteGroup", ...await deleteGroup(project, request) };
    case "AddToGroup":
      return { success: true, operation: "AddToGroup", group: await addToGroup(project, request) };
    case "RemoveFromGroup":
      return { success: true, operation: "RemoveFromGroup", group: await removeFromGroup(project, request) };
    case "Ungroup":
      return { success: true, operation: "Ungroup", ...await ungroup(project, request) };
    case "SetVisibility":
      return { success: true, operation: "SetVisibility", result: await setVisibility(project, request) };
    case "SetLayerOrder":
      return { success: true, operation: "SetLayerOrder", result: await setLayerOrder(project, request) };
    case "Align":
      return { success: true, operation: "Align", result: await align(project, request) };
    case "Distribute":
      return { success: true, operation: "Distribute", result: await distribute(project, request) };
    case "ResizeToFit":
      return { success: true, operation: "ResizeToFit", group: await resizeToFit(project, request) };
    default:
      throw new Error(`Unsupported composition operation: ${request.operation}`);
  }
}

export async function handleFieldParameterOperation(request) {
  const project = getProjectFromRequest(request);
  switch (request.operation) {
    case "List":
      return { success: true, operation: "List", fieldParameters: listFieldParameters(project) };
    case "Create":
      return { success: true, operation: "Create", fieldParameter: await createFieldParameter(project, request) };
    case "Update":
      return { success: true, operation: "Update", fieldParameter: await updateFieldParameter(project, request) };
    case "Delete":
      return { success: true, operation: "Delete", ...await deleteFieldParameter(project, request) };
    case "BindVisual":
      return { success: true, operation: "BindVisual", visual: await bindFieldParameterToVisual(project, request) };
    case "CreateSlicerControl":
      return {
        success: true,
        operation: "CreateSlicerControl",
        visual: await createFieldParameterSlicer(project, {
          ...request,
          pageName: request.slicerPageName || request.pageName
        })
      };
    default:
      throw new Error(`Unsupported field parameter operation: ${request.operation}`);
  }
}

export async function handleMobileLayoutOperation(request) {
  const project = getProjectFromRequest(request);
  switch (request.operation) {
    case "List":
      return {
        success: true,
        operation: "List",
        mobileLayouts: listMobileLayouts(project, request.pageName)
      };
    case "Get":
      return {
        success: true,
        operation: "Get",
        mobileLayout: getMobileLayout(project, request)
      };
    case "AutoCreateFromDesktop":
      return {
        success: true,
        operation: "AutoCreateFromDesktop",
        mobileLayouts: await autoCreateMobileLayout(project, request)
      };
    case "PlaceVisual":
      return {
        success: true,
        operation: "PlaceVisual",
        mobileLayout: await placeMobileVisual(project, request)
      };
    case "UpdateVisual":
      return {
        success: true,
        operation: "UpdateVisual",
        mobileLayout: await updateMobileVisual(project, request)
      };
    case "RemoveVisual":
      return {
        success: true,
        operation: "RemoveVisual",
        ...await removeMobileVisual(project, request)
      };
    case "Clear":
      return {
        success: true,
        operation: "Clear",
        ...await clearMobileLayout(project, request)
      };
    default:
      throw new Error(`Unsupported mobile layout operation: ${request.operation}`);
  }
}

export async function handleTemplateOperation(request) {
  if (request.operation === "ListTemplates") {
    return {
      success: true,
      operation: "ListTemplates",
      templates: listTemplates()
    };
  }

  const project = getProjectFromRequest(request);
  switch (request.operation) {
    case "CreatePageFromTemplate":
      return runWithChanges(request, "template", "CreatePageFromTemplate", async () => ({
        success: true,
        operation: "CreatePageFromTemplate",
        ...await createPageFromTemplate(project, request)
      }));
    case "ApplyVisualStylePreset":
      return runWithChanges(request, "template", "ApplyVisualStylePreset", async () => ({
        success: true,
        operation: "ApplyVisualStylePreset",
        ...await applyVisualStylePreset(project, request)
      }));
    case "CreateKpiStrip":
      return runWithChanges(request, "template", "CreateKpiStrip", async () => ({
        success: true,
        operation: "CreateKpiStrip",
        ...await createKpiStrip(project, request)
      }));
    case "CreateFilterBar":
      return runWithChanges(request, "template", "CreateFilterBar", async () => ({
        success: true,
        operation: "CreateFilterBar",
        ...await createFilterBar(project, request)
      }));
    case "CreateTooltipLayout":
      return runWithChanges(request, "template", "CreateTooltipLayout", async () => ({
        success: true,
        operation: "CreateTooltipLayout",
        ...await createTooltipLayout(project, request)
      }));
    default:
      throw new Error(`Unsupported template operation: ${request.operation}`);
  }
}

export { createBlankProjectFixture };
