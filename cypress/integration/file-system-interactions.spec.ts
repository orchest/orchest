import { PROJECTS_DIR, SAMPLE_PROJECT_NAMES } from "../support/common";

describe("file system interactions", () => {
  beforeEach(() => {
    cy.setOnboardingCompleted("true");
  });

  it("creates a project through the FS", () => {
    cy.exec(`mkdir ${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}`);
    // Need to force a reload to discover.
    cy.visit("/projects");
    cy.findAllByTestId("projects-table-row").should("have.length", 1);
  });

  it("deletes a project through the FS", () => {
    cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    cy.exec(`rm -rf ${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}`);
    // Need to force a reload to discover.
    cy.visit("/projects");
    cy.findAllByTestId("projects-table-row").should("have.length", 0);
  });

  it("creates multiple projects through the FS", () => {
    let projects = Array.from(Array(20).keys());
    projects.map((project) => {
      cy.exec(`mkdir ${PROJECTS_DIR}/${project}`);
    });
    // Need to force a reload to discover.
    cy.visit("/projects");
    cy.findByTestId("projects-table-body", { timeout: 10000 }).should("exist");
    cy.findAllByTestId("projects-table-row", { timeout: 10000 }).should(
      "have.length",
      projects.length
    );
  });

  it("deletes multiple projects through the FS", () => {
    let projects = Array.from(Array(5).keys());
    projects.map((project) => {
      cy.createProject(project.toString());
    });
    cy.cleanProjectsDir();
    // Need to force a reload to discover.
    cy.visit("/projects");
    cy.findAllByTestId("projects-table-row").should("have.length", 0);
  });
});
