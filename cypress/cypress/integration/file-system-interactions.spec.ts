import {
  PROJECTS_DIR,
  reloadUntilElementsLoaded,
  reset,
  SAMPLE_PIPELINE_NAMES,
  SAMPLE_PROJECT_NAMES,
  TEST_ID,
} from "../support/common";

describe("file system interactions", () => {
  beforeEach(() => {
    cy.disableCheckUpdate();
    reset();
    cy.setOnboardingCompleted("true");
  });

  it("creates a project through the FS", () => {
    cy.exec(`mkdir ${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}`);
    // Need to force a reload to discover.

    reloadUntilElementsLoaded("project-list-row", () => {
      cy.findByTestId("project-list").should("exist");
      return cy.findByTestId("loading-table-row").should("not.exist");
    });
  });

  it("deletes a project through the FS", () => {
    cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    cy.exec(`rm -rf ${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}`);
    // Need to force a reload to discover.

    reloadUntilElementsLoaded(
      "project-list-row",
      () => {
        cy.findByTestId("project-list").should("exist");
        return cy.findByTestId("loading-table-row").should("not.exist");
      },
      0
    );
  });

  it("creates multiple projects through the FS", () => {
    let projects = Array.from(Array(20).keys());

    cy.exec(
      projects
        .reduce((prev, project) => {
          return [...prev, `mkdir ${PROJECTS_DIR}/${project}`];
        }, [])
        .join(" && ")
    );

    cy.navigateViaProjectDrawer("projects");
    reloadUntilElementsLoaded(
      "project-list-row",
      () => {
        cy.findByTestId("project-list", { timeout: 10000 }).should("exist");
        return cy.findByTestId("loading-table-row").should("not.exist");
      },
      10
    );

    cy.reload();

    // ! This can break if MUI implementation changes
    cy.get(
      `[data-test-id=project-list-pagination] .MuiTablePagination-displayedRows`,
      { timeout: 10000 }
    ).contains(` of ${projects.length}`); // 1–10 of 20
  });

  it("deletes multiple projects through the FS", () => {
    let projects = Array.from(Array(5).keys());
    projects.map((project) => {
      cy.createProject(project.toString());
    });
    cy.cleanProjectsDir();
    // Need to force a reload to discover.
    cy.visit("/projects");
    reloadUntilElementsLoaded(
      "project-list-row",
      () => {
        cy.findByTestId("project-list").should("exist");
        return cy.findByTestId("loading-table-row").should("not.exist");
      },
      0
    );
  });

  context("requires an existing project", () => {
    beforeEach(() => {
      cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    });

    it("deletes a pipeline through the fs", () => {
      cy.createPipeline(SAMPLE_PIPELINE_NAMES.PL1);
      let expectedFile = `${SAMPLE_PIPELINE_NAMES.PL1.replaceAll(
        "-",
        "_"
      )}.orchest`;
      let expectedPath = `${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/${expectedFile}`;
      // Make sure the creation went well.
      cy.readFile(expectedPath);
      // Remove through the FS, expect Orchest to be aware when
      // refreshing.
      cy.exec(`rm ${expectedPath}`);
      // Reload to force the discovery.
      reloadUntilElementsLoaded(
        TEST_ID.PIPELINES_TABLE_ROW,
        () => {
          cy.findByTestId("pipeline-list").should("exist");
          return cy.findByTestId("loading-table-row").should("not.exist");
        },
        0
      );
    });

    it("moves a project through the fs", () => {
      cy.exec(
        `mv ${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1} ${PROJECTS_DIR}/move-project`
      );

      reloadUntilElementsLoaded("project-list-row", () => {
        cy.findByTestId("project-list").should("exist");
        return cy.findByTestId("loading-table-row").should("not.exist");
      });

      cy.findByTestId(TEST_ID.PROJECTS_TABLE_ROW).should(
        "contain.text",
        "move-project"
      );
    });
  });
});
