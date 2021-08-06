import { QUICKSTART_URL } from "../support/common";
import { TEST_ID } from "../support/common";

enum PROJECT_NAMES {
  P1 = "test-project-1",
  P2 = "test-project-2",
}

describe("projects", () => {
  beforeEach(() => {
    cy.setOnboardingCompleted("true");
    cy.visit("/projects");
  });

  context("should have projects after running", () => {
    afterEach(() => {
      cy.visit("/projects");
      cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should(
        "have.length.at.least",
        1
      );
      ["/pipelines", "/jobs", "/environments"].map((view) => {
        cy.visit(view);
        cy.findByTestId("project-selector").should(
          "contain.text",
          PROJECT_NAMES.P1
        );
      });
    });

    it("creates a project", () => {
      cy.createProject(PROJECT_NAMES.P1);
    });

    it("imports a project", () => {
      cy.importProject(QUICKSTART_URL, PROJECT_NAMES.P1);
      // 30 seconds to import the project.
      cy.findByTestId(TEST_ID.IMPORT_PROJECT_DIALOG, { timeout: 30000 }).should(
        "not.exist"
      );
    });

    // Changing view is a workaround for closing the modal.
    it("imports a project, closes the modal", () => {
      cy.importProject(QUICKSTART_URL, PROJECT_NAMES.P1);
      cy.get("body").trigger("keydown", { keyCode: 27 });
      // 30 seconds to import the project.
      cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW, { timeout: 30000 }).should(
        "have.length.at.least",
        1
      );
    });
  });

  context("should have no projects after running", () => {
    afterEach(() => {
      cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should("have.length", 0);
    });

    it("deletes the created project", () => {
      cy.createProject("test");
      cy.findByTestId(TEST_ID.PROJECTS_TABLE_TOGGLE_ALL_ROWS)
        .should("exist")
        .click();
      cy.findByTestId(TEST_ID.DELETE_PROJECT)
        .should("exist")
        .and("be.visible")
        .click();

      cy.findByTestId(TEST_ID.CONFIRM_DIALOG_OK)
        .should("exist")
        .and("be.visible")
        .click();
    });
  });

  context("project environment variables", () => {
    beforeEach(() => {
      cy.createProject(PROJECT_NAMES.P1);
      cy.findByTestId(`settings-button-${PROJECT_NAMES.P1}`).click();
    });

    it("test adding a variable", () => {
      cy.addProjectEnvVars(PROJECT_NAMES.P1, ["v1"], ["v2"]);
      cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_VALUE).should(
        "have.length",
        1
      );
    });

    it("test multiple variables", () => {
      let vars = ["1", "2", "3", "4"];
      cy.addProjectEnvVars(
        PROJECT_NAMES.P1,
        vars,
        vars.map((x) => `v${x}`)
      );
      cy.reload();
      cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_VALUE).should(
        "have.length",
        vars.length
      );
    });
  });
});
