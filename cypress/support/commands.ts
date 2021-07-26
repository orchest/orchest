import "cypress-localstorage-commands";
import "@testing-library/cypress/add-commands";
import { TEST_ID } from "../support/common";

type TBooleanString = "true" | "false";

declare global {
  namespace Cypress {
    interface Chainable {
      addProjectEnvVar(
        project: string,
        name: string,
        value: string
      ): Chainable<undefined>;
      cleanDataDir(): Chainable<undefined>;
      cleanProjectsDir(): Chainable<undefined>;
      createProject(name: string): Chainable<undefined>;
      getOnboardingCompleted(): Chainable<TBooleanString>;
      importProject(url: string, name?: string): Chainable<undefined>;
      setOnboardingCompleted(value: TBooleanString): void;
    }
  }
}

const LOCAL_STORAGE_KEY = "orchest.onboarding_completed";
const DATA_DIR = "userdir/data";
const PROJECTS_DIR = "userdir/projects";
const TESTS_DATA_DIR = DATA_DIR + "/integration-tests";

Cypress.Commands.add("setOnboardingCompleted", (value: TBooleanString) => {
  cy.setLocalStorage(LOCAL_STORAGE_KEY, value);
});

Cypress.Commands.add("getOnboardingCompleted", () =>
  cy.getLocalStorage(LOCAL_STORAGE_KEY)
);

// Make sure no test impacts the data directory. Note that
Cypress.Commands.add("cleanDataDir", () => cy.exec(`rm -rf ${DATA_DIR}/*`));

Cypress.Commands.add("cleanProjectsDir", () =>
  cy.exec(`rm -rf ${PROJECTS_DIR}/*`)
);

Cypress.Commands.add("createProject", (name) => {
  cy.findByTestId(TEST_ID.ADD_PROJECT)
    .should("exist")
    .and("be.visible")
    .click();
  cy.findByTestId(TEST_ID.PROJECT_NAME_TEXTFIELD).type(name);
  cy.findByTestId(TEST_ID.CREATE_PROJECT).click();
  return cy
    .findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW)
    .should("have.length.at.least", 1);
});

Cypress.Commands.add("importProject", (url, name) => {
  cy.findByTestId(TEST_ID.IMPORT_PROJECT)
    .should("exist")
    .and("be.visible")
    .click();
  cy.findByTestId(TEST_ID.PROJECT_URL_TEXTFIELD).type(url);
  cy.findByTestId(TEST_ID.PROJECT_NAME_TEXTFIELD).type(name);
  cy.findByTestId(TEST_ID.IMPORT_PROJECT_OK).click();
});

Cypress.Commands.add("addProjectEnvVar", (project, name, value) => {
  cy.visit("/projects");
  cy.findByTestId(`settings-button-${project}`).click();
  cy.findByTestId(TEST_ID.PROJECT_ENV_VAR_ADD).click();
  // Would not support concurrent adds.
  cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_NAME).last().type(name);
  cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_VALUE).last().type(value);
  cy.findByTestId(TEST_ID.PROJECT_SETTINGS_SAVE).click();
});

before(() => {
  cy.configureCypressTestingLibrary({ testIdAttribute: "data-test-id" });
});

beforeEach(() => {
  cy.cleanDataDir();
  cy.cleanProjectsDir();
});
