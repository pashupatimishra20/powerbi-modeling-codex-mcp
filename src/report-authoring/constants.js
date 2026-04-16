export const REPORT_PROJECT_SERVER_NAME = "powerbi-report-authoring-mcp";
export const REPORT_PROJECT_SERVER_VERSION = "0.8.0";

export const SCHEMA_URLS = {
  definitionProperties:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definitionProperties/2.0.0/schema.json",
  report:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/report/1.0.0/schema.json",
  version:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/versionMetadata/1.0.0/schema.json",
  pages:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/pagesMetadata/1.0.0/schema.json",
  page:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/1.0.0/schema.json",
  visual:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.0.0/schema.json",
  visualMobileState:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainerMobileState/1.0.0/schema.json",
  bookmark:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/bookmark/1.0.0/schema.json",
  bookmarks:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/bookmarksMetadata/1.0.0/schema.json",
  reportExtension:
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/reportExtension/1.0.0/schema.json"
};

export const DEFAULT_PAGE_SIZE = {
  width: 1280,
  height: 720,
  displayOption: "FitToPage"
};

export const DEFAULT_REPORT = {
  $schema: SCHEMA_URLS.report,
  themeCollection: {
    baseTheme: {
      name: "CY22SU11",
      reportVersionAtImport: "5.40",
      type: "SharedResources"
    }
  },
  layoutOptimization: "None",
  settings: {
    isPersistentUserStateDisabled: true,
    useStylableVisualContainerHeader: true,
    defaultFilterActionIsDataFilter: true,
    defaultDrillFilterOtherVisuals: true,
    allowChangeFilterTypes: true,
    useEnhancedTooltips: true,
    useDefaultAggregateDisplayName: true
  },
  slowDataSourceSettings: {
    isCrossHighlightingDisabled: false,
    isSlicerSelectionsButtonEnabled: false,
    isFilterSelectionsButtonEnabled: false,
    isFieldWellButtonEnabled: false,
    isApplyAllButtonEnabled: false
  }
};

export const DEFAULT_VERSION_METADATA = {
  $schema: SCHEMA_URLS.version,
  version: "2.0.0"
};

export const DEFAULT_BOOKMARK_EXPLORATION_VERSION = "1.0";

export const DEFAULT_DEFINITION_VERSION = "4.0";

export const SUPPORTED_VISUAL_TYPES = [
  "card",
  "multiRowCard",
  "table",
  "matrix",
  "clusteredBarChart",
  "clusteredColumnChart",
  "stackedBarChart",
  "stackedColumnChart",
  "lineChart",
  "areaChart",
  "lineAndClusteredColumnChart",
  "pieChart",
  "donutChart",
  "slicer",
  "textbox",
  "actionButton"
];

export const SUPPORTED_CONTROL_TYPES = [
  "backButton",
  "bookmarkButton",
  "drillthroughButton",
  "bookmarkNavigator",
  "pageNavigationButton",
  "pageNavigator",
  "applyAllSlicersButton",
  "clearAllSlicersButton",
  "webUrlButton",
  "qnaButton"
];

export const TOOL_DEFINITIONS = {
  report_project_operations: {
    description:
      "Perform operations on PBIR/PBIP report projects. Supported operations: OpenProject, GetProject, ValidateProject, ListSchemas.",
    operations: ["OpenProject", "GetProject", "ValidateProject", "ListSchemas"]
  },
  report_page_operations: {
    description:
      "Perform operations on PBIR report pages. Supported operations: List, Get, Create, Update, Delete, Reorder, Duplicate.",
    operations: ["List", "Get", "Create", "Update", "Delete", "Reorder", "Duplicate"]
  },
  report_visual_operations: {
    description:
      "Perform operations on PBIR report visuals. Supported operations: List, Get, Create, Update, Delete, Duplicate, Move, BindFields, SetFormatting.",
    operations: [
      "List",
      "Get",
      "Create",
      "Update",
      "Delete",
      "Duplicate",
      "Move",
      "BindFields",
      "SetFormatting"
    ]
  },
  report_bookmark_operations: {
    description:
      "Perform operations on PBIR report bookmarks. Supported operations: List, Get, Create, Update, Delete, Reorder, CreateGroup, UpdateGroup, DeleteGroup.",
    operations: [
      "List",
      "Get",
      "Create",
      "Update",
      "Delete",
      "Reorder",
      "CreateGroup",
      "UpdateGroup",
      "DeleteGroup"
    ]
  },
  report_interaction_operations: {
    description:
      "Configure PBIR drillthrough, tooltips, visual interactions, slicer sync, and interactive controls. Supported operations: ConfigureDrillthroughPage, ClearDrillthroughPage, ConfigureCrossReportDrillthroughPage, ClearCrossReportDrillthroughPage, ConfigureTooltipPage, ClearTooltipPage, AssignTooltip, SetVisualInteractions, SetSlicerSync, CreatePageNavigationButton, CreatePageNavigator, CreateSlicerActionButton, CreateWebUrlButton, CreateQnaButton, CreateControl, UpdateControl.",
    operations: [
      "ConfigureDrillthroughPage",
      "ClearDrillthroughPage",
      "ConfigureCrossReportDrillthroughPage",
      "ClearCrossReportDrillthroughPage",
      "ConfigureTooltipPage",
      "ClearTooltipPage",
      "AssignTooltip",
      "SetVisualInteractions",
      "SetSlicerSync",
      "CreatePageNavigationButton",
      "CreatePageNavigator",
      "CreateSlicerActionButton",
      "CreateWebUrlButton",
      "CreateQnaButton",
      "CreateControl",
      "UpdateControl"
    ]
  },
  report_field_parameter_operations: {
    description:
      "Orchestrate Power BI field parameters across the semantic model MCP and PBIR report. Supported operations: List, Create, Update, Delete, BindVisual, CreateSlicerControl.",
    operations: ["List", "Create", "Update", "Delete", "BindVisual", "CreateSlicerControl"]
  },
  report_mobile_layout_operations: {
    description:
      "Author PBIR visual mobile layout metadata. Supported operations: List, Get, AutoCreateFromDesktop, PlaceVisual, UpdateVisual, RemoveVisual, Clear.",
    operations: ["List", "Get", "AutoCreateFromDesktop", "PlaceVisual", "UpdateVisual", "RemoveVisual", "Clear"]
  },
  report_composition_operations: {
    description:
      "Author PBIR visual grouping, visibility, layer order, and layout composition metadata. Supported operations: ListGroups, GetGroup, CreateGroup, UpdateGroup, DeleteGroup, AddToGroup, RemoveFromGroup, Ungroup, SetVisibility, SetLayerOrder, Align, Distribute, ResizeToFit.",
    operations: [
      "ListGroups",
      "GetGroup",
      "CreateGroup",
      "UpdateGroup",
      "DeleteGroup",
      "AddToGroup",
      "RemoveFromGroup",
      "Ungroup",
      "SetVisibility",
      "SetLayerOrder",
      "Align",
      "Distribute",
      "ResizeToFit"
    ]
  }
};

const sharedRequestProperties = {
  projectPath: { type: ["string", "null"] }
};

export const TOOL_SCHEMAS = {
  report_project_operations: {
    type: "object",
    properties: {
      request: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: TOOL_DEFINITIONS.report_project_operations.operations
          },
          ...sharedRequestProperties
        },
        required: ["operation"],
        additionalProperties: true
      }
    },
    required: ["request"],
    additionalProperties: false
  },
  report_page_operations: {
    type: "object",
    properties: {
      request: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: TOOL_DEFINITIONS.report_page_operations.operations
          },
          ...sharedRequestProperties,
          pageName: { type: ["string", "null"] },
          targetPageName: { type: ["string", "null"] },
          displayName: { type: ["string", "null"] },
          pageType: { type: ["string", "null"] },
          width: { type: ["number", "integer", "null"] },
          height: { type: ["number", "integer", "null"] },
          hidden: { type: ["boolean", "null"] },
          active: { type: ["boolean", "null"] },
          duplicateFromPage: { type: ["string", "null"] },
          background: { type: ["object", "null"] },
          tooltipTarget: { type: ["string", "null"] },
          pageOrder: {
            type: ["array", "null"],
            items: { type: "string" }
          }
        },
        required: ["operation"],
        additionalProperties: true
      }
    },
    required: ["request"],
    additionalProperties: false
  },
  report_visual_operations: {
    type: "object",
    properties: {
      request: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: TOOL_DEFINITIONS.report_visual_operations.operations
          },
          ...sharedRequestProperties,
          pageName: { type: ["string", "null"] },
          targetPageName: { type: ["string", "null"] },
          visualName: { type: ["string", "null"] },
          name: { type: ["string", "null"] },
          visualType: {
            type: ["string", "null"],
            enum: [...SUPPORTED_VISUAL_TYPES, null]
          },
          layout: { type: ["object", "null"] },
          bindings: { type: ["object", "null"] },
          title: { type: ["string", "null"] },
          subtitle: { type: ["string", "null"] },
          filters: { type: ["object", "array", "null"] },
          sort: { type: ["object", "null"] },
          format: { type: ["object", "null"] },
          visibility: { type: ["boolean", "null"] },
          textValue: { type: ["string", "null"] }
        },
        required: ["operation"],
        additionalProperties: true
      }
    },
    required: ["request"],
    additionalProperties: false
  },
  report_bookmark_operations: {
    type: "object",
    properties: {
      request: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: TOOL_DEFINITIONS.report_bookmark_operations.operations
          },
          ...sharedRequestProperties,
          bookmarkName: { type: ["string", "null"] },
          displayName: { type: ["string", "null"] },
          pageName: { type: ["string", "null"] },
          groupName: { type: ["string", "null"] },
          targetGroupName: { type: ["string", "null"] },
          itemsOrder: { type: ["array", "null"], items: { type: "string" } },
          bookmarkOrder: { type: ["array", "null"], items: { type: "string" } },
          explorationState: { type: ["object", "null"] },
          sections: { type: ["object", "null"] },
          filters: { type: ["object", "null"] },
          objects: { type: ["object", "null"] },
          options: { type: ["object", "null"] }
        },
        required: ["operation"],
        additionalProperties: true
      }
    },
    required: ["request"],
    additionalProperties: false
  },
  report_interaction_operations: {
    type: "object",
    properties: {
      request: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: TOOL_DEFINITIONS.report_interaction_operations.operations
          },
          ...sharedRequestProperties,
          pageName: { type: ["string", "null"] },
          visualName: { type: ["string", "null"] },
          controlName: { type: ["string", "null"] },
          controlType: {
            type: ["string", "null"],
            enum: [...SUPPORTED_CONTROL_TYPES, null]
          },
          layout: { type: ["object", "null"] },
          format: { type: ["object", "null"] },
          action: { type: ["object", "null"] },
          title: { type: ["string", "null"] },
          fieldRefs: { type: ["array", "null"], items: { type: "string" } },
          fieldDisplayNames: { type: ["array", "null"], items: { type: "string" } },
          acceptsFilterContext: { type: ["string", "boolean", "null"] },
          autoCreateBackButton: { type: ["boolean", "null"] },
          hidden: { type: ["boolean", "null"] },
          groupName: { type: ["string", "null"] },
          syncFieldChanges: { type: ["boolean", "null"] },
          syncFilterChanges: { type: ["boolean", "null"] },
          bookmarkName: { type: ["string", "null"] },
          drillthroughPageName: { type: ["string", "null"] },
          tooltipPageName: { type: ["string", "null"] },
          targetPageName: { type: ["string", "null"] },
          deselectionBookmarkName: { type: ["string", "null"] },
          webUrl: { type: ["string", "null"] },
          qnaQuestion: { type: ["string", "null"] },
          orientation: { type: ["string", "null"] },
          showHiddenPages: { type: ["boolean", "null"] },
          showTooltipPages: { type: ["boolean", "null"] },
          sourceVisualName: { type: ["string", "null"] },
          targetVisualName: { type: ["string", "null"] },
          interactionType: { type: ["string", "null"] },
          drillingFiltersOtherVisuals: { type: ["boolean", "null"] },
          replaceExisting: { type: ["boolean", "null"] },
          spacing: { type: ["number", "integer", "null"] },
          slicerAction: {
            type: ["string", "null"],
            enum: ["ApplyAllSlicers", "ClearAllSlicers", null]
          },
          interactions: {
            type: ["array", "null"],
            items: {
              type: "object",
              properties: {
                sourceVisualName: { type: "string" },
                targetVisualName: { type: "string" },
                interactionType: { type: "string" }
              },
              required: ["sourceVisualName", "targetVisualName", "interactionType"],
              additionalProperties: true
            }
          }
        },
        required: ["operation"],
        additionalProperties: true
      }
    },
    required: ["request"],
    additionalProperties: false
  },
  report_field_parameter_operations: {
    type: "object",
    properties: {
      request: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: TOOL_DEFINITIONS.report_field_parameter_operations.operations
          },
          ...sharedRequestProperties,
          parameterName: { type: ["string", "null"] },
          displayName: { type: ["string", "null"] },
          pageName: { type: ["string", "null"] },
          visualName: { type: ["string", "null"] },
          role: { type: ["string", "null"] },
          createSlicer: { type: ["boolean", "null"] },
          slicerPageName: { type: ["string", "null"] },
          slicerName: { type: ["string", "null"] },
          layout: { type: ["object", "null"] },
          fields: {
            type: ["array", "null"],
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                reference: { type: "string" },
                order: { type: ["number", "integer", "null"] }
              },
              required: ["label", "reference"],
              additionalProperties: true
            }
          }
        },
        required: ["operation"],
        additionalProperties: true
      }
    },
    required: ["request"],
    additionalProperties: false
  },
  report_mobile_layout_operations: {
    type: "object",
    properties: {
      request: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: TOOL_DEFINITIONS.report_mobile_layout_operations.operations
          },
          ...sharedRequestProperties,
          pageName: { type: ["string", "null"] },
          visualName: { type: ["string", "null"] },
          layout: { type: ["object", "null"] },
          format: { type: ["object", "null"] },
          autoPosition: { type: ["boolean", "null"] }
        },
        required: ["operation"],
        additionalProperties: true
      }
    },
    required: ["request"],
    additionalProperties: false
  },
  report_composition_operations: {
    type: "object",
    properties: {
      request: {
        type: "object",
        properties: {
          operation: {
            type: "string",
            enum: TOOL_DEFINITIONS.report_composition_operations.operations
          },
          ...sharedRequestProperties,
          pageName: { type: ["string", "null"] },
          visualName: { type: ["string", "null"] },
          visualNames: { type: ["array", "null"], items: { type: "string" } },
          groupName: { type: ["string", "null"] },
          displayName: { type: ["string", "null"] },
          parentGroupName: { type: ["string", "null"] },
          layout: { type: ["object", "null"] },
          visibility: { type: ["boolean", "null"] },
          groupMode: { type: ["string", "null"] },
          alignment: { type: ["string", "null"] },
          distribution: { type: ["string", "null"] },
          layerAction: { type: ["string", "null"] }
        },
        required: ["operation"],
        additionalProperties: true
      }
    },
    required: ["request"],
    additionalProperties: false
  }
};
