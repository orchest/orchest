import "cypress-localstorage-commands";
import "@testing-library/cypress/add-commands";
import { TEST_ID } from "../support/common";
import { LOCAL_STORAGE_KEY } from "../support/common";
import { DATA_DIR } from "../support/common";
import { PROJECTS_DIR } from "../support/common";
import { assertTotalEnvironmentImages } from "../support/common";
import { TESTS_DATA_DIR } from "../support/common";

type TBooleanString = "true" | "false";

declare global {
  namespace Cypress {
    interface Chainable {
      addPipelineEnvVars(
        pipeline: string,
        names: string[],
        values: string[]
      ): Chainable<undefined>;
      addProjectEnvVars(
        project: string,
        names: string[],
        values: string[]
      ): Chainable<undefined>;
      cleanDataDir(): Chainable<undefined>;
      createEnvironment(
        name: string,
        script?: string,
        build?: boolean,
        waitBuild?: boolean
      ): Chainable<undefined>;
      createPipeline(name: string, path?: string): Chainable<undefined>;
      createProject(name: string): Chainable<undefined>;
      createStep(
        title: string,
        createNewFile?: boolean,
        fileName?: string
      ): Chainable<undefined>;
      cleanProjectsDir(): Chainable<undefined>;
      createUser(name: string, password: string): Chainable<undefined>;
      deleteAllEnvironments(): Chainable<undefined>;
      deleteAllPipelines(): Chainable<undefined>;
      deleteAllUsers(): Chainable<undefined>;
      deleteUser(name: string): Chainable<undefined>;
      getEnvironmentUUID(
        projectUUID: string,
        environment: string
      ): Chainable<string>;
      getIframe(data_test_id: string): Chainable<JQuery<any>>;
      getOnboardingCompleted(): Chainable<TBooleanString>;
      getProjectUUID(project: string): Chainable<string>;
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

Cypress.Commands.add(
  "addProjectEnvVars",
  (project: string, names: string[], values: string[]) => {
    assert(names.length == values.length);
    cy.visit("/projects");
    cy.findByTestId(`settings-button-${project}`).click();
    for (let i = 0; i < names.length; i++) {
      cy.findByTestId(TEST_ID.PROJECT_ENV_VAR_ADD).click();
      // Would not support concurrent adds.
      cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_NAME).last().type(names[i]);
      cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_VALUE).last().type(values[i]);
    }
    cy.findByTestId(TEST_ID.PROJECT_SETTINGS_SAVE).click();
    cy.wait("@allPuts");
  }
);

Cypress.Commands.add(
  "addPipelineEnvVars",
  (pipeline: string, names: string[], values: string[]) => {
    assert(names.length == values.length);
    cy.visit("/pipelines");
    cy.findByTestId(`pipeline-${pipeline}`).click();
    cy.findByTestId(TEST_ID.PIPELINE_SETTINGS).click();
    cy.findByTestId(
      TEST_ID.PIPELINE_SETTINGS_TAB_ENVIRONMENT_VARIABLES
    ).click();
    for (let i = 0; i < names.length; i++) {
      cy.findByTestId(TEST_ID.PIPELINE_ENV_VAR_ADD).click();
      // Would not support concurrent adds.
      cy.findAllByTestId(TEST_ID.PIPELINE_ENV_VAR_NAME).last().type(names[i]);
      cy.findAllByTestId(TEST_ID.PIPELINE_ENV_VAR_VALUE).last().type(values[i]);
    }
    cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_SAVE).click();
    cy.wait("@allPuts");
  }
);

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
  cy.wait("@allDeletes");
});

Cypress.Commands.add(
  "createEnvironment",
  (name: string, script?: string, build?: boolean, waitBuild?: boolean) => {
    cy.visit("environments");
    cy.findByTestId(TEST_ID.ENVIRONMENTS_CREATE).should("be.visible").click();

    cy.findByTestId(TEST_ID.ENVIRONMENTS_ENV_NAME)
      .should("be.visible")
      .type("{selectall}{backspace}" + name);

    cy.findByTestId(TEST_ID.ENVIRONMENTS_TAB_BUILD).scrollIntoView().click();
    cy.findByTestId(TEST_ID.ENVIRONMENTS_SAVE)
      .scrollIntoView()
      .should("be.visible")
      .click();
    if (script !== undefined) {
      let deletions = "{backspace}".repeat(30);
      cy.get(".CodeMirror-line")
        .first()
        .type(deletions + script);
      cy.findByTestId(TEST_ID.ENVIRONMENTS_SAVE).scrollIntoView().click();
    }
    if (build) {
      cy.findByTestId(TEST_ID.ENVIRONMENTS_START_BUILD)
        .scrollIntoView()
        .should("be.visible")
        .click();
      cy.findByTestId(TEST_ID.ENVIRONMENTS_BUILD_STATUS)
        .scrollIntoView()
        .should("be.visible")
        .contains(/PENDING|STARTED/);
      if (waitBuild) {
        cy.findByTestId(TEST_ID.ENVIRONMENTS_BUILD_STATUS)
          .scrollIntoView()
          .should("be.visible")
          .contains("SUCCESS", { timeout: 20000 });
      }
    }
    cy.wait("@allPosts");
  }
);

Cypress.Commands.add("createPipeline", (name: string, path?: string) => {
  cy.visit("/pipelines");
  cy.findByTestId(TEST_ID.PIPELINE_CREATE).should("be.visible").click();
  cy.findByTestId(TEST_ID.PIPELINE_NAME_TEXTFIELD)
    .should("be.visible")
    .type("{selectall}{backspace}")
    .type(name);
  let expected_path = name.toLowerCase().replace(/[\W]/g, "_") + ".orchest";
  cy.findByTestId(TEST_ID.PIPELINE_PATH_TEXTFIELD).should(
    "have.value",
    expected_path
  );
  if (path !== undefined) {
    cy.findByTestId(TEST_ID.PIPELINE_PATH_TEXTFIELD)
      .type("{selectall}{backspace}")
      .type(path);
  }
  cy.findByTestId(TEST_ID.PIPELINE_CREATE_OK).click();
  cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).should("have.length", 1);
});

// Assumes to be in the pipeline editor, in edit mode (not read-only).
Cypress.Commands.add(
  "createStep",
  (title: string, createNewFile?: boolean, fileName?: string) => {
    cy.findByTestId(TEST_ID.STEP_CREATE).click();
    cy.findByTestId(TEST_ID.STEP_TITLE_TEXTFIELD)
      .type("{selectall}{backspace}")
      .type(title);
    cy.findByTestId(TEST_ID.FILE_PICKER_FILE_PATH_TEXTFIELD).click();
    if (createNewFile) {
      cy.findByTestId(TEST_ID.FILE_PICKER_NEW_FILE).click();
      cy.findByTestId(
        TEST_ID.PROJECT_FILE_PICKER_CREATE_NEW_FILE_DIALOG
      ).should("be.visible");
      if (fileName !== undefined) {
        cy.findByTestId(TEST_ID.PROJECT_FILE_PICKER_FILE_NAME_TEXTFIELD)
          .type("{selectall}{backspace}")
          .type(fileName);
      }
      cy.findByTestId(TEST_ID.PROJECT_FILE_PICKER_CREATE_FILE).click();
    } else if (fileName !== undefined) {
      cy.findByTestId(TEST_ID.FILE_PICKER_FILE_PATH_TEXTFIELD)
        .type("{selectall}{backspace}")
        .type(fileName);
    }
    cy.wait("@allPosts");
    // Press ESC to close the step menu.
    cy.get("body").trigger("keydown", { keyCode: 27 });
    cy.wait(100);
    cy.get("body").trigger("keyup", { keyCode: 27 });
  }
);

// Note: currently not idempotent.
Cypress.Commands.add("deleteAllEnvironments", () => {
  cy.visit("/environments");
  cy.findByTestId(TEST_ID.ENVIRONMENTS_TOGGLE_ALL_ROWS).click();
  cy.findByTestId(TEST_ID.ENVIRONMENTS_DELETE).click();
  cy.findByTestId(TEST_ID.CONFIRM_DIALOG_OK).click();
  cy.wait("@allDeletes");
});

// Note: currently not idempotent.
Cypress.Commands.add("deleteAllPipelines", () => {
  cy.visit("/pipelines");
  // se rows != 0 then deleta
  cy.findByTestId(TEST_ID.PIPELINES_TABLE_TOGGLE_ALL_ROWS).click();
  cy.findByTestId(TEST_ID.PIPELINES_TABLE_TOGGLE_ALL_ROWS).click();
  cy.findByTestId(TEST_ID.PIPELINE_DELETE).click();
  cy.findByTestId(TEST_ID.CONFIRM_DIALOG_OK).click();
  cy.wait("@allDeletes");
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

//Assumes environment names are unique.
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
          'docker images --filter "label=_orchest_env_build_task_uuid" -q | wc -l'
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

beforeEach(() => {
  // When these intercept declarations where in "before()" cypress was
  // reporting issues.
  cy.intercept(/.*/).as("allRequests");
  cy.intercept("GET", /.*/).as("allGets");
  cy.intercept("POST", /.*/).as("allPosts");
  cy.intercept("PUT", /.*/).as("allPuts");
  cy.intercept("DELETE", /.*/).as("allDeletes");
  cy.intercept("GET", /\/store\/environments\/.*/).as("storeGets");

  cy.cleanDataDir();
  cy.cleanProjectsDir();
  // Force rediscovery of deleted projects.
  cy.visit("/projects");
  assertTotalEnvironmentImages(0);
});
