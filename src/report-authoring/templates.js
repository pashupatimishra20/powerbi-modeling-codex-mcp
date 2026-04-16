import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { deepClone } from "./json.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_ROOT = path.resolve(__dirname, "../../assets/pbir-templates");

const TEMPLATE_FILES = {
  actionButton: "actionButton.visual.json",
  backButton: "backButton.visual.json",
  bookmarkButton: "bookmarkButton.visual.json",
  bookmarkNavigator: "bookmarkNavigator.visual.json",
  pageNavigationButton: "pageNavigationButton.visual.json",
  pageNavigator: "pageNavigator.visual.json",
  applyAllSlicersButton: "applyAllSlicersButton.visual.json",
  clearAllSlicersButton: "clearAllSlicersButton.visual.json",
  webUrlButton: "webUrlButton.visual.json",
  qnaButton: "qnaButton.visual.json",
  card: "card.visual.json",
  multiRowCard: "multiRowCard.visual.json",
  tableEx: "tableEx.visual.json",
  columnChart: "columnChart.visual.json",
  clusteredBarChart: "clusteredBarChart.visual.json",
  pieChart: "pieChart.visual.json",
  slicer: "slicer.visual.json",
  drillthroughButton: "drillthroughButton.visual.json"
};

let cache = null;

function loadBaseTemplates() {
  if (cache) {
    return cache;
  }

  cache = {};
  for (const [key, fileName] of Object.entries(TEMPLATE_FILES)) {
    const filePath = path.join(TEMPLATE_ROOT, fileName);
    cache[key] = JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  return cache;
}

function createTextboxTemplate() {
  return {
    $schema:
      "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/1.0.0/schema.json",
    name: "textbox_template",
    position: {
      x: 0,
      y: 0,
      z: 0,
      width: 320,
      height: 120,
      tabOrder: 0
    },
    visual: {
      visualType: "textbox",
      objects: {
        general: [
          {
            properties: {
              paragraphs: {
                expr: {
                  Literal: {
                    Value: "'New text box'"
                  }
                }
              }
            }
          }
        ]
      },
      drillFilterOtherVisuals: true
    }
  };
}

export function getControlTemplate(controlType) {
  const templates = loadBaseTemplates();
  const template = templates[controlType];
  if (!template) {
    throw new Error(`Unsupported control template: ${controlType}`);
  }
  return deepClone(template);
}

export function getVisualTemplate(visualType) {
  const templates = loadBaseTemplates();
  switch (visualType) {
    case "card":
      return deepClone(templates.card);
    case "multiRowCard":
      return deepClone(templates.multiRowCard);
    case "table":
      return deepClone(templates.tableEx);
    case "matrix": {
      const template = deepClone(templates.tableEx);
      template.visual.visualType = "pivotTable";
      return template;
    }
    case "clusteredBarChart":
      return deepClone(templates.clusteredBarChart);
    case "stackedBarChart": {
      const template = deepClone(templates.clusteredBarChart);
      template.visual.visualType = "stackedBarChart";
      return template;
    }
    case "clusteredColumnChart": {
      const template = deepClone(templates.columnChart);
      template.visual.visualType = "clusteredColumnChart";
      return template;
    }
    case "stackedColumnChart": {
      const template = deepClone(templates.columnChart);
      template.visual.visualType = "stackedColumnChart";
      return template;
    }
    case "lineChart": {
      const template = deepClone(templates.columnChart);
      template.visual.visualType = "lineChart";
      return template;
    }
    case "areaChart": {
      const template = deepClone(templates.columnChart);
      template.visual.visualType = "areaChart";
      return template;
    }
    case "lineAndClusteredColumnChart": {
      const template = deepClone(templates.columnChart);
      template.visual.visualType = "lineAndClusteredColumnChart";
      return template;
    }
    case "pieChart":
      return deepClone(templates.pieChart);
    case "donutChart": {
      const template = deepClone(templates.pieChart);
      template.visual.visualType = "donutChart";
      return template;
    }
    case "slicer":
      return deepClone(templates.slicer);
    case "textbox":
      return createTextboxTemplate();
    case "actionButton":
      return deepClone(templates.actionButton);
    default:
      throw new Error(`Unsupported visual type: ${visualType}`);
  }
}
