import {
  QUICKSTART_URL,
  reset,
  SAMPLE_PROJECT_NAMES,
  TEST_ID,
} from "../support/common";

describe("projects", () => {
  beforeEach(() => {
    cy.disableCheckUpdate();
    reset();
    cy.setOnboardingCompleted("true");
    cy.goToMenu("projects");
  });

  context("should have projects after running", () => {
    afterEach(() => {
      cy.goToMenu("projects");
      cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should(
        "have.length.at.least",
        1
      );
      ["pipelines", "jobs", "environments"].map((menuEntry) => {
        cy.goToMenu(menuEntry);
        cy.findByTestId("project-selector").should(
          "contain.text",
          SAMPLE_PROJECT_NAMES.P1
        );
      });
    });

    it("creates a project", () => {
      cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    });

    it("imports a project", () => {
      cy.importProject(QUICKSTART_URL, SAMPLE_PROJECT_NAMES.P1);
      // 30 seconds to import the project.
      cy.findByTestId(TEST_ID.IMPORT_PROJECT_DIALOG, { timeout: 60000 }).should(
        "not.exist"
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
      cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    });

    it("test adding a variable", () => {
      cy.addProjectEnvVars(SAMPLE_PROJECT_NAMES.P1, ["v1"], ["v2"]);
      cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_VALUE).should(
        "have.length",
        1
      );
    });

    it("test multiple variables", () => {
      let vars = ["1", "2", "3", "4"];
      cy.addProjectEnvVars(
        SAMPLE_PROJECT_NAMES.P1,
        vars,
        vars.map((x) => `v${x}`)
      );
      cy.reload(true);
      cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_VALUE).should(
        "have.length",
        vars.length
      );
    });
  });
});
