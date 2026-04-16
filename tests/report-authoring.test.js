import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

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
} from "../src/report-authoring/bookmark-service.js";
import {
  bindFieldParameterToVisual,
  createFieldParameter,
  createFieldParameterSlicer,
  deleteFieldParameter,
  listFieldParameters,
  updateFieldParameter
} from "../src/report-authoring/field-parameter-service.js";
import {
  clearDrillthroughPage,
  clearTooltipPage,
  configureTooltipPage,
  configureDrillthroughPage,
  assignTooltip,
  createControl,
  setVisualInteractions,
  setSlicerSync,
  updateControl
} from "../src/report-authoring/interaction-service.js";
import {
  autoCreateMobileLayout,
  clearMobileLayout,
  getMobileLayout,
  listMobileLayouts,
  placeMobileVisual,
  removeMobileVisual,
  updateMobileVisual
} from "../src/report-authoring/mobile-layout-service.js";
import {
  resetModelingClientFactory,
  setModelingClientFactory
} from "../src/report-authoring/modeling-mcp-client.js";
import {
  createBlankProjectFixture,
  createPage,
  duplicatePage,
  getPage,
  listPages,
  listVisualNames,
  openProject,
  reorderPages,
  reportFile,
  updatePage,
  validateProject
} from "../src/report-authoring/project-service.js";
import {
  buildSemanticModelIndex,
  resolveFieldReference
} from "../src/report-authoring/semantic-model.js";
import {
  bindVisualFields,
  createVisual,
  deleteVisual,
  duplicateVisual,
  getVisual,
  listVisuals,
  moveVisual,
  updateVisual
} from "../src/report-authoring/visual-service.js";

function copyFixtureProject(reportFolder = "SalesReport.Report") {
  const sourceRoot = path.resolve("tests/fixtures");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pbir-authoring-"));
  fs.cpSync(sourceRoot, tempRoot, { recursive: true });
  return {
    tempRoot,
    reportRoot: path.join(tempRoot, reportFolder)
  };
}

function getAnnotationValue(definition, name) {
  return definition.annotations?.find((annotation) => annotation.name === name)?.value ?? null;
}

function getNavigatorButtons(project, pageName, controlName) {
  return listVisualNames(project, pageName)
    .map((visualName) => getVisual(project, pageName, visualName))
    .filter((definition) => getAnnotationValue(definition, "codex.navigatorName") === controlName)
    .sort((left, right) => (left.position?.tabOrder || 0) - (right.position?.tabOrder || 0));
}

test("opens and validates the sample PBIR project", async () => {
  const { reportRoot } = copyFixtureProject();
  const project = openProject(reportRoot);
  const validation = await validateProject(project);
  assert.equal(validation.valid, true);
  assert.equal(listPages(project).length, 1);
  assert.equal(project.semanticModel.tables.has("Sales"), true);
});

test("opens and validates the interactive PBIR fixture", async () => {
  const { reportRoot } = copyFixtureProject("InteractiveReport.Report");
  const project = openProject(reportRoot);
  const validation = await validateProject(project);
  assert.equal(validation.valid, true);
  assert.equal(listPages(project).length, 3);
  assert.equal(listBookmarks(project).length, 1);
  assert.equal(getPage(project, "Details").pageBinding.type, "Drillthrough");
  assert.equal(getPage(project, "TooltipPage").pageBinding.type, "Tooltip");
  assert.equal(getVisual(project, "ReportSection", "CategorySyncSlicer").visual.syncGroup.groupName, "CategoryPages");
  assert.equal(listMobileLayouts(project, "ReportSection").length, 1);
});

test("opens a PBIP manifest by resolving its report artifact", () => {
  const { tempRoot, reportRoot } = copyFixtureProject();
  const pbipPath = path.join(tempRoot, "SalesReport.pbip");
  fs.writeFileSync(
    pbipPath,
    JSON.stringify(
      {
        $schema:
          "https://developer.microsoft.com/json-schemas/fabric/pbip/pbipProperties/1.0.0/schema.json",
        version: "1.0",
        artifacts: [{ report: { path: "SalesReport.Report" } }]
      },
      null,
      2
    )
  );

  const project = openProject(pbipPath);
  assert.equal(project.root, reportRoot);
});

test("normalizes quoted TMDL identifiers for measures and hierarchies", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pbir-semantic-"));
  const semanticModelRoot = path.join(tempRoot, "Quoted.SemanticModel");
  const tablesRoot = path.join(semanticModelRoot, "definition", "tables");
  fs.mkdirSync(tablesRoot, { recursive: true });
  fs.writeFileSync(
    path.join(tablesRoot, "Quoted.tmdl"),
    [
      "table 'Fact Table'",
      "\tmeasure 'Total Candidates' = 1",
      "\thierarchy 'Date Hierarchy'",
      "\t\tlevel 'Calendar Year'"
    ].join("\n")
  );

  const index = buildSemanticModelIndex(semanticModelRoot);
  assert.equal(index.measures.get("Total Candidates"), "Fact Table");
  assert.equal(resolveFieldReference("[Total Candidates]", index).tableName, "Fact Table");
  assert.equal(
    resolveFieldReference("Fact Table[Date Hierarchy].[Calendar Year]", index).hierarchyName,
    "Date Hierarchy"
  );
});

test("creates, updates, duplicates, moves, and deletes visuals across supported types", async () => {
  const { reportRoot } = copyFixtureProject();
  const project = openProject(reportRoot);
  const createdPage = await createPage(project, {
    pageName: "GeneratedPage",
    displayName: "Generated Page",
    active: true
  });
  assert.equal(createdPage.name, "GeneratedPage");

  const supportedVisuals = [
    { visualType: "card", bindings: { values: ["[Total Sales]"] } },
    { visualType: "multiRowCard", bindings: { values: ["Sales[Category]", "[Total Sales]"] } },
    { visualType: "table", bindings: { values: ["Sales[Category]", "Sales[Amount]"] } },
    { visualType: "matrix", bindings: { values: ["Sales[Category]", "[Total Sales]"] } },
    { visualType: "clusteredBarChart", bindings: { category: ["Sales[Category]"], values: ["Sales[Amount]"] } },
    { visualType: "clusteredColumnChart", bindings: { category: ["Sales[Category]"], values: ["[Total Sales]"] } },
    { visualType: "stackedBarChart", bindings: { category: ["Sales[Category]"], values: ["Sales[Amount]"] } },
    { visualType: "stackedColumnChart", bindings: { category: ["Sales[Category]"], values: ["[Total Sales]"] } },
    { visualType: "lineChart", bindings: { category: ["Date[Month]"], values: ["[Total Sales]"] } },
    { visualType: "areaChart", bindings: { category: ["Date[Month]"], values: ["[Net Sales]"] } },
    {
      visualType: "lineAndClusteredColumnChart",
      bindings: {
        category: ["Date[Month]"],
        columnValues: ["[Total Sales]"],
        lineValues: ["[Net Sales]"]
      }
    },
    { visualType: "pieChart", bindings: { category: ["Sales[Category]"], values: ["[Total Sales]"] } },
    { visualType: "donutChart", bindings: { category: ["Sales[Category]"], values: ["[Net Sales]"] } },
    { visualType: "slicer", bindings: { values: ["Sales[Category]"] } },
    { visualType: "slicer", bindings: { values: ["Date[Calendar].[Month]"] } },
    { visualType: "textbox", bindings: {}, textValue: "Executive summary" }
  ];

  const created = [];
  for (const [index, spec] of supportedVisuals.entries()) {
    const visual = await createVisual(project, {
      pageName: "GeneratedPage",
      visualType: spec.visualType,
      bindings: spec.bindings,
      title: `${spec.visualType} title`,
      textValue: spec.textValue,
      layout: {
        x: index * 10,
        y: index * 10,
        width: 320,
        height: 180
      }
    });
    created.push(visual);
  }

  assert.equal(created.length, supportedVisuals.length);

  const updated = await updateVisual(project, {
    pageName: "GeneratedPage",
    visualName: created[0].name,
    title: "Updated card title",
    layout: { x: 22, y: 44, width: 280, height: 160 },
    format: { legendVisible: false, dataLabelsVisible: true }
  });
  assert.equal(updated.position.x, 22);

  const duplicated = await duplicateVisual(project, {
    pageName: "GeneratedPage",
    visualName: created[1].name,
    targetPageName: "ReportSection"
  });
  assert.equal(duplicated.visual.visualType, "multiRowCard");

  const moved = await moveVisual(project, {
    pageName: "GeneratedPage",
    visualName: created[2].name,
    targetPageName: "ReportSection"
  });
  assert.equal(moved.visual.visualType, "tableEx");

  const rebound = await bindVisualFields(project, {
    pageName: "GeneratedPage",
    visualName: created[8].name,
    bindings: {
      category: ["Date[Month]"],
      values: ["[Net Sales]"]
    }
  });
  assert.equal(rebound.visual.query.queryState.Y.projections[0].queryRef, "Sales.Net Sales");

  const deleted = await deleteVisual(project, {
    pageName: "GeneratedPage",
    visualName: created[3].name
  });
  assert.ok(deleted.visuals.every((visual) => visual.name !== created[3].name));
});

test("manages bookmarks, groups, and metadata ordering", async () => {
  const { reportRoot } = copyFixtureProject();
  const project = openProject(reportRoot);

  const group = await createBookmarkGroup(project, {
    displayName: "Compare Views",
    groupName: "CompareViews"
  });
  assert.equal(group.name, "CompareViews");

  const created = await createBookmark(project, {
    bookmarkName: "WestOnly",
    displayName: "West Only",
    pageName: "ReportSection",
    groupName: "CompareViews"
  });
  assert.equal(created.displayName, "West Only");

  const updated = await updateBookmark(project, {
    bookmarkName: "WestOnly",
    displayName: "West Coast",
    options: {
      suppressDisplay: true,
      applyOnlyToTargetVisuals: true,
      targetVisualNames: ["VisualA"]
    }
  });
  assert.equal(updated.displayName, "West Coast");
  assert.equal(updated.options.applyOnlyToTargetVisuals, true);

  const regrouped = await updateBookmark(project, {
    bookmarkName: "WestOnly",
    groupName: null
  });
  assert.equal(regrouped.name, "WestOnly");

  await updateBookmarkGroup(project, {
    groupName: "CompareViews",
    displayName: "Comparison Views"
  });

  await reorderBookmarks(project, {
    itemsOrder: ["CompareViews", "WestOnly"]
  });

  const bookmarks = listBookmarks(project);
  assert.equal(bookmarks.find((bookmark) => bookmark.name === "WestOnly").groupName, null);

  const deletedBookmark = await deleteBookmark(project, {
    bookmarkName: "WestOnly"
  });
  assert.equal(deletedBookmark.bookmarks.some((bookmark) => bookmark.name === "WestOnly"), false);

  const deletedGroup = await deleteBookmarkGroup(project, {
    groupName: "CompareViews"
  });
  assert.equal(Array.isArray(deletedGroup.bookmarks), true);
});

test("configures drillthrough, slicer sync, and interactive controls", async () => {
  const { reportRoot } = copyFixtureProject();
  const project = openProject(reportRoot);

  await createPage(project, {
    pageName: "Details",
    displayName: "Details"
  });

  const slicer = await createVisual(project, {
    pageName: "ReportSection",
    name: "CategorySlicer",
    visualType: "slicer",
    bindings: {
      values: ["Sales[Category]"]
    }
  });

  const synced = await setSlicerSync(project, {
    pageName: "ReportSection",
    visualName: slicer.name,
    groupName: "CrossPageCategory",
    syncFieldChanges: false,
    syncFilterChanges: true
  });
  assert.equal(synced.visual.syncGroup.groupName, "CrossPageCategory");

  const drillthrough = await configureDrillthroughPage(project, {
    pageName: "Details",
    fieldRefs: ["Sales[Category]"]
  });
  assert.equal(drillthrough.page.pageBinding.type, "Drillthrough");
  assert.equal(drillthrough.backButton.visual.visualType, "actionButton");

  await createBookmark(project, {
    bookmarkName: "OverviewDefault",
    displayName: "Overview",
    pageName: "ReportSection"
  });
  await createBookmark(project, {
    bookmarkName: "OverviewAlt",
    displayName: "Overview Alt",
    pageName: "ReportSection"
  });

  const bookmarkButton = await createControl(project, {
    pageName: "ReportSection",
    controlType: "bookmarkButton",
    controlName: "GoOverview",
    bookmarkName: "OverviewDefault",
    title: "Overview"
  });
  assert.equal(bookmarkButton.visual.visualType, "actionButton");

  const drillthroughButton = await createControl(project, {
    pageName: "ReportSection",
    controlType: "drillthroughButton",
    controlName: "GoDetails",
    drillthroughPageName: "Details",
    title: "Details"
  });
  assert.equal(drillthroughButton.visual.visualType, "actionButton");

  const navigator = await createControl(project, {
    pageName: "ReportSection",
    controlType: "bookmarkNavigator",
    controlName: "TopNav",
    layout: { x: 0, y: 100, width: 120, height: 36 }
  });
  assert.equal(navigator.visuals.length, 2);

  const updatedNavigator = await updateControl(project, {
    pageName: "ReportSection",
    controlType: "bookmarkNavigator",
    controlName: "TopNav",
    orientation: "vertical"
  });
  assert.equal(updatedNavigator.visuals.length, 2);

  const updatedButton = await updateControl(project, {
    pageName: "ReportSection",
    controlName: "GoOverview",
    bookmarkName: "OverviewAlt",
    title: "Alternate"
  });
  assert.equal(
    updatedButton.visual.visualContainerObjects.title[0].properties.text.expr.Literal.Value,
    "'Alternate'"
  );

  const cleared = await clearDrillthroughPage(project, {
    pageName: "Details"
  });
  assert.equal(cleared.pageBinding, undefined);
});

test("configures tooltip pages, visual interactions, slicer action buttons, and mobile layouts", async () => {
  const { reportRoot } = copyFixtureProject();
  const project = openProject(reportRoot);

  await createPage(project, {
    pageName: "TooltipPage",
    displayName: "Tooltip Page"
  });

  const chart = await createVisual(project, {
    pageName: "ReportSection",
    name: "SalesArea",
    visualType: "areaChart",
    bindings: {
      category: ["Date[Month]"],
      values: ["[Total Sales]"]
    }
  });

  const configuredTooltip = await configureTooltipPage(project, {
    pageName: "TooltipPage",
    fieldRefs: ["Sales[Category]"]
  });
  assert.equal(configuredTooltip.pageBinding.type, "Tooltip");
  assert.equal(configuredTooltip.visibility, "HiddenInViewMode");

  const tooltipAssigned = await assignTooltip(project, {
    pageName: "ReportSection",
    visualName: chart.name,
    tooltipPageName: "TooltipPage"
  });
  assert.equal(
    tooltipAssigned.visual.visualContainerObjects.visualTooltip[0].properties.section.expr.Literal.Value,
    "'TooltipPage'"
  );

  const interactionResult = await setVisualInteractions(project, {
    pageName: "ReportSection",
    sourceVisualName: chart.name,
    targetVisualName: chart.name,
    interactionType: "none",
    drillingFiltersOtherVisuals: true
  });
  assert.equal(interactionResult.page.visualInteractions[0].type, "NoFilter");
  assert.equal(interactionResult.sourceVisual.visual.drillFilterOtherVisuals, true);

  await createControl(project, {
    pageName: "ReportSection",
    controlType: "applyAllSlicersButton",
    controlName: "ApplySlicers"
  });
  await createControl(project, {
    pageName: "ReportSection",
    controlType: "clearAllSlicersButton",
    controlName: "ClearSlicers"
  });

  const reportDefinition = JSON.parse(fs.readFileSync(reportFile(project), "utf8"));
  assert.equal(reportDefinition.slowDataSourceSettings.isApplyAllButtonEnabled, true);

  const placed = await placeMobileVisual(project, {
    pageName: "ReportSection",
    visualName: chart.name,
    layout: { x: 8, y: 12, width: 304, height: 140 }
  });
  assert.equal(placed.position.width, 304);

  const updated = await updateMobileVisual(project, {
    pageName: "ReportSection",
    visualName: chart.name,
    layout: { x: 10, y: 20, width: 280, height: 150 },
    format: { title: "Mobile title" }
  });
  assert.equal(updated.position.x, 10);

  const fetched = getMobileLayout(project, {
    pageName: "ReportSection",
    visualName: chart.name
  });
  assert.equal(fetched.position.height, 150);

  const autoCreated = await autoCreateMobileLayout(project, {
    pageName: "ReportSection"
  });
  assert.ok(autoCreated.length >= 1);

  const removed = await removeMobileVisual(project, {
    pageName: "ReportSection",
    visualName: chart.name
  });
  assert.equal(removed.mobileLayouts.some((layout) => layout.visualName === chart.name), false);

  const clearedMobile = await clearMobileLayout(project, {
    pageName: "ReportSection"
  });
  assert.equal(clearedMobile.mobileLayouts.length, 0);

  await clearTooltipPage(project, {
    pageName: "TooltipPage"
  });
  const tooltipCleared = getVisual(project, "ReportSection", chart.name);
  assert.equal(tooltipCleared.visual.visualContainerObjects.visualTooltip, undefined);
});

test("keeps generated page navigators in sync with page mutations", async () => {
  const { reportRoot } = copyFixtureProject();
  const project = openProject(reportRoot);

  const navigator = await createControl(project, {
    pageName: "ReportSection",
    controlType: "pageNavigator",
    controlName: "MainPages",
    layout: { x: 0, y: 0, width: 120, height: 36 }
  });
  assert.equal(navigator.visuals.length, 1);

  await createPage(project, {
    pageName: "Trends",
    displayName: "Trends"
  });
  assert.equal(getNavigatorButtons(project, "ReportSection", "MainPages").length, 2);

  await updatePage(project, {
    pageName: "Trends",
    displayName: "Trend Page"
  });
  assert.equal(
    getNavigatorButtons(project, "ReportSection", "MainPages")[1].visual.visualContainerObjects.title[0].properties.text.expr.Literal.Value,
    "'Trend Page'"
  );

  await duplicatePage(project, {
    pageName: "Trends",
    targetPageName: "TrendsCopy",
    displayName: "Trends Copy"
  });
  assert.equal(getNavigatorButtons(project, "ReportSection", "MainPages").length, 3);

  await reorderPages(project, {
    pageOrder: ["TrendsCopy", "ReportSection", "Trends"]
  });
  const reordered = getNavigatorButtons(project, "ReportSection", "MainPages");
  assert.equal(
    reordered[0].visual.visualContainerObjects.title[0].properties.text.expr.Literal.Value,
    "'Trends Copy'"
  );

  await updatePage(project, {
    pageName: "Trends",
    hidden: true
  });
  const afterHide = getNavigatorButtons(project, "ReportSection", "MainPages");
  assert.equal(afterHide.length, 2);
  assert.equal(
    afterHide.some((definition) => {
      const titleValue =
        definition.visual.visualContainerObjects.title[0].properties.text.expr.Literal.Value;
      return titleValue === "'Trend Page'";
    }),
    false
  );
});

test("creates, updates, deletes, and binds field parameters via the modeling MCP wrapper", async () => {
  const { reportRoot } = copyFixtureProject();
  const project = openProject(reportRoot);
  const calls = [];

  setModelingClientFactory(async () => ({
    async callTool(name, args) {
      calls.push({ name, args });
      const request = args.request || {};
      if (name === "connection_operations") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                connectionName: "FolderConnection",
                operation: request.Operation
              })
            }
          ]
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              operation: request.Operation
            })
          }
        ]
      };
    },
    stop() {}
  }));

  try {
    const created = await createFieldParameter(project, {
      parameterName: "DynamicAxis",
      pageName: "ReportSection",
      fields: [
        { label: "Category", reference: "Sales[Category]" },
        { label: "Total Sales", reference: "[Total Sales]" }
      ]
    });
    assert.match(created.daxExpression, /NAMEOF\('Sales'\[Category\]\)/);
    assert.match(created.daxExpression, /NAMEOF\('Sales'\[Total Sales\]\)/);

    const visual = await createVisual(project, {
      pageName: "ReportSection",
      name: "SalesChart",
      visualType: "clusteredColumnChart",
      bindings: {
        category: ["Sales[Category]"],
        values: ["[Total Sales]"]
      }
    });

    const rebound = await bindFieldParameterToVisual(project, {
      parameterName: "DynamicAxis",
      pageName: "ReportSection",
      visualName: visual.name,
      role: "Category"
    });
    assert.equal(
      rebound.visual.query.queryState.Category.projections[0].queryRef,
      "DynamicAxis.DynamicAxis"
    );

    const slicer = await createFieldParameterSlicer(project, {
      parameterName: "DynamicAxis",
      pageName: "ReportSection",
      slicerName: "DynamicAxisSlicer"
    });
    assert.equal(slicer.visual.visualType, "slicer");

    await updateFieldParameter(project, {
      parameterName: "DynamicAxis",
      fields: [
        { label: "Month", reference: "Date[Month]" },
        { label: "Net Sales", reference: "[Net Sales]" }
      ]
    });

    const listed = listFieldParameters(project);
    assert.ok(Array.isArray(listed));

    const deleted = await deleteFieldParameter(project, {
      parameterName: "DynamicAxis"
    });
    assert.equal(deleted.deletedParameterName, "DynamicAxis");
  } finally {
    resetModelingClientFactory();
  }

  const operations = calls.map((call) => `${call.name}:${call.args.request.Operation}`);
  assert.ok(operations.includes("connection_operations:ConnectFolder"));
  assert.ok(operations.includes("table_operations:Create"));
  assert.ok(operations.includes("table_operations:Delete"));
});

test("rejects non-PBIR inputs and invalid bindings", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pbir-invalid-"));
  createBlankProjectFixture(path.join(tempRoot, "Broken.Report"), "../SalesReport.SemanticModel");

  assert.throws(
    () => openProject(path.join(tempRoot, "missing.Report")),
    /(Unsupported report project path|Missing definition folder)/
  );

  const { reportRoot } = copyFixtureProject();
  const project = openProject(reportRoot);

  await assert.rejects(
    () =>
      createVisual(project, {
        pageName: "ReportSection",
        visualType: "pieChart",
        bindings: {
          category: ["Sales[MissingCategory]"],
          values: ["[Total Sales]"]
        }
      }),
    /Unknown column reference/
  );

  const badSlicer = await createVisual(project, {
    pageName: "ReportSection",
    name: "BadSlicer",
    visualType: "slicer",
    bindings: {
      values: ["Sales[Category]", "Sales[Amount]"]
    }
  });

  await assert.rejects(
    () =>
      setSlicerSync(project, {
        pageName: "ReportSection",
        visualName: badSlicer.name,
        groupName: "BadGroup"
      }),
    /single bound field/
  );
});
