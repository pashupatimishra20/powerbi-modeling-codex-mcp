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
  configureDrillthroughPage,
  createControl,
  setSlicerSync,
  updateControl
} from "../src/report-authoring/interaction-service.js";
import {
  resetModelingClientFactory,
  setModelingClientFactory
} from "../src/report-authoring/modeling-mcp-client.js";
import {
  createBlankProjectFixture,
  createPage,
  getPage,
  listPages,
  openProject,
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
  assert.equal(listPages(project).length, 2);
  assert.equal(listBookmarks(project).length, 1);
  assert.equal(getPage(project, "Details").pageBinding.type, "Drillthrough");
  assert.equal(getVisual(project, "ReportSection", "CategorySyncSlicer").visual.syncGroup.groupName, "CategoryPages");
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
    { visualType: "lineChart", bindings: { category: ["Date[Month]"], values: ["[Total Sales]"] } },
    { visualType: "pieChart", bindings: { category: ["Sales[Category]"], values: ["[Total Sales]"] } },
    { visualType: "slicer", bindings: { values: ["Sales[Category]"] } },
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
    visualName: created[6].name,
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
