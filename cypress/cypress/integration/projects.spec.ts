import { QUICKSTART_URL, TEST_ID } from "../support/common";

describe("projects", () => {
  beforeEach(() => {
    cy.disableCheckUpdate();
    cy.deleteAllProjects();
    cy.visit("/projects", { log: false });
    cy.setOnboardingCompleted("true");
  });

  context("adding projects", () => {
    it("creates a project and ensures it's selected in all views", () => {
      const name = "CREATED";

      cy.intercept("POST", "/async/projects*").as("createProject");

      cy.findByTestId(TEST_ID.PROJECTS_HEADER_NEW_PROJECT_BUTTON).click();
      cy.findByTestId(TEST_ID.CREATE_PROJECT_DIALOG_NAME_INPUT).type(name);
      cy.findByTestId(TEST_ID.CREATE_PROJECT_DIALOG_SUBMIT_BUTTON).click();
      cy.wait("@createProject");

      cy.assertInProjectsTable(name);

      (["pipeline", "jobs", "environments", "jupyter-lab"] as const).map(
        (entry) => {
          cy.navigateViaTopMenu(entry);
          cy.wait(100);
          cy.findByTestId("project-selector").should("contain.text", name);
        }
      );
    });

    it("imports a 'quickstart' with a name", () => {
      const name = "IMPORTED_QUICKSTART";

      cy.findByTestId(TEST_ID.PROJECTS_HEADER_IMPORT_BUTTON).click();
      cy.findByTestId(TEST_ID.PROJECT_URL_TEXTFIELD).type(QUICKSTART_URL);
      cy.findByTestId(TEST_ID.IMPORT_PROJECT_DIALOG_NEXT_BUTTON).click();

      cy.findByTestId(TEST_ID.IMPORT_DIALOG_NAME_INPUT).clear().type(name);
      cy.findByTestId(TEST_ID.IMPORT_PROJECT_DIALOG_NEXT_BUTTON, {
        timeout: 120000,
      })
        .should("be.enabled")
        .wait(100)
        .click();

      cy.findByTestId(TEST_ID.IMPORT_SUCCESS_DIALOG_CLOSE_BUTTON).click();

      cy.assertInProjectsTable(name);
    });

    it("imports a 'quickstart' project as 'quickstart-{uuid}' when the import dialog is closed", () => {
      cy.findByTestId(TEST_ID.PROJECTS_HEADER_IMPORT_BUTTON).click();
      cy.findByTestId(TEST_ID.PROJECT_URL_TEXTFIELD).type(QUICKSTART_URL);
      cy.findByTestId(TEST_ID.IMPORT_PROJECT_DIALOG_NEXT_BUTTON).click();

      // Wait until import is complete:
      cy.findByTestId(TEST_ID.IMPORT_PROJECT_DIALOG_NEXT_BUTTON, {
        timeout: 120000,
      }).should("be.enabled");

      // This is the only way to close the dialog at the time of writing:
      cy.reload();

      cy.get("[data-test-id^='projects-table-row-quickstart-']").should(
        "be.visible"
      );
    });
  });

  context("environment variables", () => {
    it("adds variables to a project through settings", () => {
      const name = "ENV_VARS";
      const vars = ["1", "2", "3", "4"];

      cy.createProject(name);
      cy.addProjectEnvVars(
        name,
        vars,
        vars.map((x) => `v${x}`)
      );

      // Verify that the variables are there even after reload
      cy.reload();

      cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_VALUE).should(
        "have.length",
        vars.length
      );
    });
  });

  context("deleting projects", () => {
    it("deletes a project using the context menu", () => {
      const name = "DELETED";

      cy.createProject(name);
      cy.assertInProjectsTable(name);

      cy.findByTestId(TEST_ID.PROJECTS_SETTINGS_BUTTON(name))
        .should("be.visible")
        .click();

      cy.findByTestId(TEST_ID.PROJECT_LIST_CONTEXT_MENU_DELETE, {
        timeout: 2500,
      })
        .should("be.visible")
        .click();

      cy.findByTestId(TEST_ID.CONFIRM_DIALOG_OK, { timeout: 2500 })
        .should("be.visible")
        .click();

      cy.findByTestId(TEST_ID.PROJECTS_TABLE_ROW(name), {
        timeout: 5000,
      }).should("not.exist");
    });
  });
});
