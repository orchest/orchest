import "cypress-localstorage-commands";
import "@testing-library/cypress/add-commands";
import { TEST_ID } from "../support/common";
import { LOCAL_STORAGE_KEY } from "../support/common";
import { DATA_DIR } from "../support/common";
import { PROJECTS_DIR } from "../support/common";
import { TESTS_DATA_DIR } from "../support/common";

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
      createUser(name: string, password: string): Chainable<undefined>;
      deleteAllUsers(): Chainable<undefined>;
      deleteUser(name: string): Chainable<undefined>;
      getIframe(data_test_id: string): Chainable<JQuery<any>>;
      getProjectUUID(project: string): Chainable<string>;
      getEnvironmentUUID(
        projectUUID: string,
        environment: string
      ): Chainable<string>;
      getOnboardingCompleted(): Chainable<TBooleanString>;
      importProject(url: string, name?: string): Chainable<undefined>;
      setOnboardingCompleted(value: TBooleanString): Chainable<undefined>;
      totalEnvironmentImages(
        project?: string,
        environment?: string
      ): Chainable<number>;
    }
  }
}

Cypress.Commands.add("setOnboardingCompleted", (value: TBooleanString) => {
  cy.setLocalStorage(LOCAL_STORAGE_KEY, value);
});

Cypress.Commands.add("getOnboardingCompleted", () =>
  cy.getLocalStorage(LOCAL_STORAGE_KEY)
);

// Make sure no test impacts the data directory. Note that
Cypress.Commands.add("cleanDataDir", () =>
  cy.exec(`rm -rf ${DATA_DIR}/*`, { failOnNonZeroExit: false })
);

Cypress.Commands.add("cleanProjectsDir", () =>
  cy.exec(`rm -rf ${PROJECTS_DIR}/*`, { failOnNonZeroExit: false })
);

Cypress.Commands.add("createProject", (name) => {
  cy.visit("/projects");
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
  cy.visit("/projects");
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

Cypress.Commands.add("createUser", (name, password) => {
  cy.visit("/settings");
  cy.findByTestId(TEST_ID.MANAGE_USERS)
    .scrollIntoView()
    .should("be.visible")
    .click();
  cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
    .findByTestId(TEST_ID.NEW_USER_NAME)
    .should("be.visible")
    .type(name);
  cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
    .findByTestId(TEST_ID.NEW_USER_PASSWORD)
    .should("be.visible")
    .type(password);
  cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
    .findByTestId(TEST_ID.ADD_USER)
    .should("be.visible")
    .click();
  cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
    .findByTestId(`delete-user-${name}`)
    .scrollIntoView()
    .should("be.visible");
});

Cypress.Commands.add("deleteUser", (name) => {
  cy.visit("/settings");
  cy.findByTestId(TEST_ID.MANAGE_USERS)
    .scrollIntoView()
    .should("be.visible")
    .click();
  cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
    .findByTestId(`delete-user-${name}`)
    .scrollIntoView()
    .should("be.visible")
    .click();
  cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
    .findByTestId(`delete-user-${name}`)
    .should("not.exist");
});

// Note: currently not idempotent.
Cypress.Commands.add("deleteAllUsers", () => {
  cy.visit("/settings");
  cy.findByTestId(TEST_ID.MANAGE_USERS)
    .scrollIntoView()
    .should("be.visible")
    .click();
  cy.getIframe(TEST_ID.AUTH_ADMIN_IFRAME)
    .findAllByText("Delete")
    .each((del) => {
      cy.wrap(del).scrollIntoView().should("be.visible").click({ force: true });
    });
});

Cypress.Commands.add("getIframe", (data_test_id: string) => {
  // Simplify the logging to avoid cluttering logs.
  cy.log(`getIframe "${data_test_id}"`);
  return (
    cy
      .get(`iframe[data-test-id="${data_test_id}"]`, { log: false })
      .its("0.contentDocument.body", { log: false })
      .should("not.be.empty")
      // wraps "body" DOM element to allow
      // chaining more Cypress commands, like ".find(...)"
      // https://on.cypress.io/wrap
      .then((body) => cy.wrap(body, { log: false }))
  );
});

Cypress.Commands.add("getProjectUUID", (project: string) => {
  return cy
    .request("async/projects")
    .its("body")
    .then((body: Array<any>) =>
      cy.wrap(body.filter((obj) => obj.path == project)[0].uuid)
    );
});

Cypress.Commands.add(
  "getEnvironmentUUID",
  (projectUUID: string, environment: string) => {
    return cy
      .request(`store/environments/${projectUUID}`)
      .its("body")
      .then((body: Array<any>) =>
        cy.wrap(body.filter((obj) => obj.name == environment)[0].uuid)
      );
  }
);

Cypress.Commands.add(
  "totalEnvironmentImages",
  (project?: string, environment?: string) => {
    if (project === undefined && environment === undefined) {
      return cy
        .exec(
          'docker images --filter "label=_orchest_environment_uuid" -q | wc -l'
        )
        .its("stdout")
        .then((stdout) => cy.wrap(parseInt(stdout)));
    } else if (project !== undefined && environment === undefined) {
      cy.getProjectUUID(project).then((proj_uuid) => {
        return cy
          .exec(
            `docker images --filter "label=_orchest_project_uuid=${proj_uuid}" -q | wc -l`
          )
          .its("stdout")
          .then((stdout) => cy.wrap(parseInt(stdout)));
      });
    } else if (project !== undefined && environment !== undefined) {
      cy.getProjectUUID(project).then((proj_uuid) => {
        cy.getEnvironmentUUID(proj_uuid, environment).then((env_uuid) => {
          console.log(env_uuid);
          return cy
            .exec(
              `docker images --filter "label=_orchest_environment_uuid=${env_uuid}" -q | wc -l`
            )
            .its("stdout")
            .then((stdout) => cy.wrap(parseInt(stdout)));
        });
      });
    } else {
      throw new Error('"project" must be defined if environment is passed.');
    }
  }
);

before(() => {
  cy.configureCypressTestingLibrary({ testIdAttribute: "data-test-id" });
});

// This function is necessary because, as of now, cypress does not
// support retry-ability of custom commands. It can hacked into but not
// if you need to use cypress commands within the custom command. We
// need to use cy.exec to run system commands, and it is one of the few
// cypress commands that does not have retry-ability when following
// assertions fail.
/**
 * @param {expected}  p1 - Expected number of environment images.
 * @param {retries} p2 - How many times to retry if expected != value.
 */
function assertTotalEnvironmentImages(expected: number, retries = 10) {
  cy.totalEnvironmentImages().then((total) => {
    if (total != expected) {
      retries--;
      if (retries > 0) {
        cy.wait(1000);
        assertTotalEnvironmentImages(expected, retries);
      } else {
        throw new Error(
          `Total environment images: expected ${expected}, total ${total}`
        );
      }
    }
  });
}

beforeEach(() => {
  cy.cleanDataDir();
  cy.cleanProjectsDir();
  // Force rediscovery of deleted projects.
  cy.visit("/projects");
  assertTotalEnvironmentImages(0);
});
