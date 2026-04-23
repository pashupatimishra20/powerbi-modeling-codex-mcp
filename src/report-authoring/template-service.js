import path from "node:path";
import { fileURLToPath } from "node:url";

import { createControl, configureDrillthroughPage, configureTooltipPage } from "./interaction-service.js";
import { readJson } from "./json.js";
import { createPage, getPage } from "./project-service.js";
import { createVisual, listVisuals, updateVisual } from "./visual-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(__dirname, "../../assets/pbir-templates");

function getTemplateCatalog() {
  return readJson(path.join(TEMPLATE_ROOT, "report-templates.json")).templates;
}

function getStylePresets() {
  return readJson(path.join(TEMPLATE_ROOT, "style-presets.json")).presets;
}

function getTemplateDefinition(templateName) {
  const template = getTemplateCatalog().find((entry) => entry.name === templateName);
  if (!template) {
    throw new Error(`Unknown template: ${templateName}`);
  }
  return template;
}

function getStylePresetDefinition(presetName) {
  const preset = getStylePresets().find((entry) => entry.name === presetName);
  if (!preset) {
    throw new Error(`Unknown style preset: ${presetName}`);
  }
  return preset;
}

async function ensurePage(project, pageName, displayName) {
  try {
    return getPage(project, pageName);
  } catch {
    return createPage(project, {
      pageName,
      displayName: displayName || pageName
    });
  }
}

function normalizeKpiItems(request) {
  if (request.items?.length) {
    return request.items;
  }

  return (request.measures || []).slice(0, 3).map((measureRef, index) => ({
    title: `KPI ${index + 1}`,
    measureRef
  }));
}

export function listTemplates() {
  return getTemplateCatalog();
}

export async function createKpiStrip(project, request) {
  const page = await ensurePage(project, request.pageName, request.displayName);
  const items = normalizeKpiItems(request).slice(0, 3);
  const visuals = [];

  for (const [index, item] of items.entries()) {
    visuals.push(
      await createVisual(project, {
        pageName: page.name,
        name: item.title || `KPI${index + 1}`,
        visualType: "kpi",
        title: item.title || `KPI ${index + 1}`,
        bindings: {
          values: [item.measureRef],
          ...(request.trendField ? { trendAxis: [request.trendField] } : {}),
          ...(request.targetField ? { target: [request.targetField] } : {})
        },
        layout: {
          x: 40 + index * 220,
          y: 40,
          width: 200,
          height: 120
        }
      })
    );
  }

  return { page, visuals };
}

export async function createFilterBar(project, request) {
  const page = await ensurePage(project, request.pageName, request.displayName);
  const visuals = [];
  const controls = [];

  for (const [index, fieldRef] of (request.fields || []).entries()) {
    visuals.push(
      await createVisual(project, {
        pageName: page.name,
        name: `Filter${index + 1}`,
        visualType: "slicer",
        title: fieldRef,
        bindings: {
          values: [fieldRef]
        },
        layout: {
          x: 40 + index * 220,
          y: 16,
          width: 200,
          height: 64
        }
      })
    );
  }

  if (request.includeApplyAllSlicers) {
    controls.push(
      await createControl(project, {
        pageName: page.name,
        controlType: "applyAllSlicersButton",
        controlName: "HeaderFilterBarApply",
        title: "Apply"
      })
    );
  }

  if (request.includeClearAllSlicers) {
    controls.push(
      await createControl(project, {
        pageName: page.name,
        controlType: "clearAllSlicersButton",
        controlName: "HeaderFilterBarClear",
        title: "Clear"
      })
    );
  }

  return { page, visuals, controls };
}

export async function createTooltipLayout(project, request) {
  const page = await ensurePage(project, request.pageName, request.displayName);
  await configureTooltipPage(project, {
    pageName: page.name,
    fieldRefs: request.fieldRefs || []
  });

  const visuals = [
    await createVisual(project, {
      pageName: page.name,
      name: "TooltipTitle",
      visualType: "textbox",
      title: request.title || request.displayName || page.name,
      textValue: request.title || request.displayName || page.name,
      layout: {
        x: 16,
        y: 12,
        width: 260,
        height: 60
      }
    })
  ];

  if (request.measures?.[0]) {
    visuals.push(
      await createVisual(project, {
        pageName: page.name,
        name: "TooltipValue",
        visualType: "card",
        title: request.measures[0],
        bindings: {
          values: [request.measures[0]]
        },
        layout: {
          x: 16,
          y: 84,
          width: 180,
          height: 100
        }
      })
    );
  }

  return {
    page: getPage(project, page.name),
    visuals
  };
}

export async function applyVisualStylePreset(project, request) {
  const preset = getStylePresetDefinition(request.presetName);
  const targets = request.visualNames?.length
    ? request.visualNames.map((name) => ({ name }))
    : listVisuals(project, request.pageName);

  const updatedVisuals = [];
  for (const target of targets) {
    updatedVisuals.push(
      await updateVisual(project, {
        pageName: request.pageName,
        visualName: target.name,
        format: {
          ...preset.format,
          title: `${preset.name} - ${target.name}`
        }
      })
    );
  }

  return {
    preset,
    updatedVisuals
  };
}

async function createExecutiveSummary(project, request, template) {
  const page = await ensurePage(project, request.pageName, request.displayName);
  const kpiStrip = await createKpiStrip(project, {
    pageName: page.name,
    items: (request.measures || []).slice(0, 3).map((measureRef) => ({
      title: measureRef.replace(/^\[|\]$/g, ""),
      measureRef
    })),
    trendField: request.trendField,
    targetField: request.targetField
  });

  const visuals = [...kpiStrip.visuals];
  visuals.push(
    await createVisual(project, {
      pageName: page.name,
      name: "ExecutiveTrend",
      visualType: "lineChart",
      title: "Trend",
      bindings: {
        category: [request.trendField || "Date[Month]"],
        values: [request.measures?.[0] || "[Total Sales]"]
      },
      layout: {
        x: 40,
        y: 190,
        width: 420,
        height: 240
      }
    })
  );
  visuals.push(
    await createVisual(project, {
      pageName: page.name,
      name: "ExecutiveBreakdown",
      visualType: "clusteredColumnChart",
      title: "Breakdown",
      bindings: {
        category: [request.categoryField || "Sales[Category]"],
        values: [request.measures?.[0] || "[Total Sales]"]
      },
      layout: {
        x: 500,
        y: 190,
        width: 420,
        height: 240
      }
    })
  );

  const filterBar = await createFilterBar(project, {
    pageName: page.name,
    fields: [request.categoryField || "Sales[Category]"],
    includeClearAllSlicers: true
  });

  const presetName = request.presetName || template.defaultStylePreset;
  const preset = presetName
    ? await applyVisualStylePreset(project, {
        pageName: page.name,
        presetName,
        visualNames: visuals.map((visual) => visual.name)
      })
    : { updatedVisuals: [] };

  return {
    template,
    page: getPage(project, page.name),
    visuals,
    controls: filterBar.controls,
    updatedVisuals: preset.updatedVisuals
  };
}

async function createDetailDrillthrough(project, request, template) {
  const page = await ensurePage(project, request.pageName, request.displayName);
  const drillthrough = await configureDrillthroughPage(project, {
    pageName: page.name,
    fieldRefs: request.fieldRefs?.length ? request.fieldRefs : [request.categoryField || "Sales[Category]"]
  });

  const table = await createVisual(project, {
    pageName: page.name,
    name: "DetailTable",
    visualType: "table",
    title: "Details",
    bindings: {
      values: [
        request.categoryField || "Sales[Category]",
        ...(request.measures?.length ? request.measures : ["[Total Sales]"])
      ]
    },
    layout: {
      x: 40,
      y: 72,
      width: 720,
      height: 320
    }
  });

  return {
    template,
    page: getPage(project, page.name),
    visuals: [table],
    controls: drillthrough.backButton ? [drillthrough.backButton] : []
  };
}

export async function createPageFromTemplate(project, request) {
  const template = getTemplateDefinition(request.templateName);

  switch (template.name) {
    case "ExecutiveSummary":
      return createExecutiveSummary(project, request, template);
    case "DetailDrillthrough":
      return createDetailDrillthrough(project, request, template);
    case "TooltipMini":
      return {
        template,
        ...await createTooltipLayout(project, request)
      };
    case "HeaderFilterBar":
      return {
        template,
        ...await createFilterBar(project, request)
      };
    case "KpiStrip3Up":
      return {
        template,
        ...await createKpiStrip(project, request)
      };
    default:
      throw new Error(`Unsupported template: ${template.name}`);
  }
}
