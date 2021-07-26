import { PROJECTS_DIR } from "../support/common";

enum PROJECT_NAMES {
  P1 = "test-project-1",
  P2 = "test-project-2",
}

describe("file system interactions", () => {
  beforeEach(() => {
    cy.setOnboardingCompleted("true");
  });

  it("creates a project through the FS", () => {
    cy.exec(`mkdir ${PROJECTS_DIR}/${PROJECT_NAMES.P1}`);
    cy.visit("/projects");
    cy.findAllByTestId("projects-table-row").should("have.length", 1);
  });

  it("delete a project through the FS", () => {
    cy.createProject(PROJECT_NAMES.P1);
    cy.exec(`rm -rf ${PROJECTS_DIR}/${PROJECT_NAMES.P1}`);
    cy.visit("/projects");
    cy.findAllByTestId("projects-table-row").should("have.length", 0);
  });

  it("create multiple projects through the FS", () => {
    let projects = Array.from(Array(50).keys());
    projects.map((project) => {
      cy.exec(`mkdir ${PROJECTS_DIR}/${project}`);
    });
    cy.visit("/projects");
    cy.findAllByTestId("projects-table-row", { timeout: 15000 }).should(
      "have.length",
      projects.length
    );
  });

  it("delete multiple projects through the FS", () => {
    let projects = Array.from(Array(5).keys());
    projects.map((project) => {
      cy.createProject(project.toString());
    });
    cy.cleanProjectsDir();
    cy.visit("/projects");
    cy.findAllByTestId("projects-table-row").should("have.length", 0);
  });
});
