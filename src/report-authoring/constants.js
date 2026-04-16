export const REPORT_PROJECT_SERVER_NAME = "powerbi-report-authoring-mcp";
export const REPORT_PROJECT_SERVER_VERSION = "0.4.0";

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
    "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.0.0/schema.json"
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

export const DEFAULT_DEFINITION_VERSION = "4.0";

export const SUPPORTED_VISUAL_TYPES = [
  "card",
  "multiRowCard",
  "table",
  "matrix",
  "clusteredBarChart",
  "clusteredColumnChart",
  "lineChart",
  "pieChart",
  "slicer",
  "textbox"
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
  }
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
          projectPath: { type: ["string", "null"] }
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
          projectPath: { type: ["string", "null"] },
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
          projectPath: { type: ["string", "null"] },
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
  }
};
