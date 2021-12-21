import {
  PROJECTS_DIR,
  reset,
  SAMPLE_PIPELINE_NAMES,
  SAMPLE_PROJECT_NAMES,
  TEST_ID,
} from "../support/common";

describe("file system interactions", () => {
  beforeEach(() => {
    reset();
    cy.setOnboardingCompleted("true");
  });

  it("creates a project through the FS", () => {
    cy.exec(`mkdir ${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}`);
    // Need to force a reload to discover.
    cy.visit("/projects");
    cy.reload(true);
    cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should("have.length", 1);
  });

  it("deletes a project through the FS", () => {
    cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    cy.exec(`rm -rf ${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}`);
    // Need to force a reload to discover.
    cy.visit("/projects");
    cy.reload(true);
    cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should("have.length", 0);
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

    cy.visit("/projects");
    cy.reload(true);

    cy.findByTestId("project-list", { timeout: 10000 }).should("exist");
    // ! This can break if MUI implementation changes
    cy.findAllByTestId("project-list-pagination", { timeout: 10000 })
      .find(".MuiTablePagination-displayedRows")
      .contains(` of ${projects.length}`); // 1–10 of 20
  });

  it("deletes multiple projects through the FS", () => {
    let projects = Array.from(Array(5).keys());
    projects.map((project) => {
      cy.createProject(project.toString());
    });
    cy.cleanProjectsDir();
    // Need to force a reload to discover.
    cy.visit("/projects");
    cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should("have.length", 0);
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
      cy.visit("/pipelines");
      cy.reload(true);
      cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).should("have.length", 0);
    });

    it("moves a project through the fs", () => {
      cy.exec(
        `mv ${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1} ${PROJECTS_DIR}/move-project`
      );

      cy.visit("/projects");
      cy.reload(true);
      cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should("have.length", 1);
      cy.findByTestId(TEST_ID.PROJECTS_TABLE_ROW).should(
        "contain.text",
        "move-project"
      );
    });
  });
});
