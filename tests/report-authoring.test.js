import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import {
  createBlankProjectFixture,
  createPage,
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
  moveVisual,
  updateVisual
} from "../src/report-authoring/visual-service.js";

function copyFixtureProject() {
  const sourceRoot = path.resolve("tests/fixtures");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pbir-authoring-"));
  fs.cpSync(sourceRoot, tempRoot, { recursive: true });
  return {
    tempRoot,
    reportRoot: path.join(tempRoot, "SalesReport.Report")
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
});
