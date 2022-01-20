import "@testing-library/cypress/add-commands";
import "cypress-localstorage-commands";
import "cypress-pipe";
import {
  DATA_DIR,
  LOCAL_STORAGE_KEY,
  piped_click,
  PROJECTS_DIR,
  reloadUntilElementsLoaded,
  TEST_ID,
} from "../support/common";

/* eslint-disable @typescript-eslint/no-namespace */
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
      createProject(name: string): Chainable<JQuery<HTMLElement>>;
      createStep(
        title: string,
        createNewFile?: boolean,
        fileName?: string
      ): Chainable<undefined>;
      cleanProjectsDir(): Chainable<undefined>;
      createUser(name: string, password: string): Chainable<undefined>;
      deleteAllEnvironments(count?: number): Chainable<undefined>;
      deleteAllPipelines(): Chainable<undefined>;
      deleteAllUsers(): Chainable<undefined>;
      deleteUser(name: string): Chainable<undefined>;
      getEnvironmentUUID(
        projectUUID: string,
        environment: string
      ): Chainable<string>;
      getIframe(dataTestId: string): Chainable<JQuery<any>>;
      getOnboardingCompleted(): Chainable<string>;
      getProjectUUID(project: string): Chainable<string>;
      goToMenu(
        entry: string,
        predicate?: (location: Location) => boolean
      ): Chainable<string>;
      importProject(url: string, name?: string): Chainable<undefined>;
      reset(): Chainable<undefined>;
      setOnboardingCompleted(value: TBooleanString): Chainable<undefined>;
      totalEnvironmentImages(
        project?: string,
        environment?: string
      ): Chainable<number>;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

type TBooleanString = "true" | "false";

Cypress.Commands.add("setOnboardingCompleted", (value: TBooleanString) => {
  cy.setLocalStorage(LOCAL_STORAGE_KEY, value);
  // Needed to close the onboarding modal.
  cy.reload(true);
});

Cypress.Commands.add("getOnboardingCompleted", () =>
  cy.getLocalStorage(LOCAL_STORAGE_KEY)
);

Cypress.Commands.add("cleanDataDir", () => {
  cy.log("Cleaning the data directory.");
  cy.exec(`rm -rf ${DATA_DIR}/*`, { failOnNonZeroExit: false, log: false });
  cy.reload(true);
});

Cypress.Commands.add("cleanProjectsDir", () => {
  cy.log("Cleaning the projects directory.");
  cy.exec(`rm -rf ${PROJECTS_DIR}/*`, { failOnNonZeroExit: false, log: false });
  cy.reload(true);
});

Cypress.Commands.add("createProject", (name) => {
  cy.goToMenu("projects");
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
  cy.goToMenu("projects");
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
    cy.log("======= Start adding project env vars.");
    cy.intercept("PUT", /.*/).as("allPuts");
    assert(names.length == values.length);
    cy.goToMenu("projects");
    cy.findByTestId(`settings-button-${project}`).click();
    cy.wait(100);
    for (let i = 0; i < names.length; i++) {
      cy.findByTestId(TEST_ID.PROJECT_ENV_VAR_ADD).click();
      // Would not support concurrent adds.
      cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_NAME)
        .last()
        .find("input")
        .type(names[i]);
      cy.findAllByTestId(TEST_ID.PROJECT_ENV_VAR_VALUE)
        .last()
        .find("input")
        .type(values[i]);
    }
    cy.findByTestId(TEST_ID.PROJECT_SETTINGS_SAVE).click();
    cy.wait("@allPuts");
    cy.log("======= Done adding project env vars.");
  }
);

Cypress.Commands.add(
  "addPipelineEnvVars",
  (pipeline: string, names: string[], values: string[]) => {
    assert(names.length == values.length);
    cy.log("======= Start adding pipeline env vars.");
    cy.intercept("PUT", /.*/).as("allPuts");
    cy.goToMenu("pipelines");
    cy.findByTestId(`pipeline-list-row`).first().click();
    cy.findByTestId(TEST_ID.PIPELINE_SETTINGS).click();
    cy.findByTestId(
      TEST_ID.PIPELINE_SETTINGS_TAB_ENVIRONMENT_VARIABLES
    ).click();

    names.forEach((name, i) => {
      cy.findByTestId(TEST_ID.PIPELINE_ENV_VAR_ADD).click();
      // Would not support concurrent adds.
      cy.findAllByTestId(TEST_ID.PIPELINE_ENV_VAR_NAME).last().type(name);
      cy.findAllByTestId(TEST_ID.PIPELINE_ENV_VAR_VALUE).last().type(values[i]);
    });

    cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_SAVE).click();
    cy.wait("@allPuts");
    cy.log("======= Done adding pipeline env vars.");
  }
);

Cypress.Commands.add("createUser", (name, password) => {
  cy.goToMenu("settings");
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
  cy.goToMenu("settings");
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
  cy.intercept("DELETE", /.*/).as("allDeletes");
  cy.goToMenu("settings");
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
    cy.intercept("POST", /.*/).as("allPosts");
    cy.visit("environments");
    cy.findByTestId(TEST_ID.ENVIRONMENTS_CREATE).should("be.visible").click();

    cy.findByTestId(TEST_ID.ENVIRONMENTS_ENV_NAME)
      .should("be.visible")
      .type("{selectall}{backspace}" + name);

    cy.findByTestId(TEST_ID.ENVIRONMENT_TAB_BUILD).scrollIntoView().click();
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
      cy.findByTestId(TEST_ID.ENVIRONMENT_START_BUILD)
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
  cy.log("======== Start creating pipeline");
  cy.goToMenu("pipelines");
  cy.findByTestId(TEST_ID.PIPELINE_CREATE).should("be.visible").click();
  cy.findByTestId(TEST_ID.PIPELINE_NAME_TEXTFIELD)
    .should("be.visible")
    .type("{selectall}{backspace}")
    .type(name);
  let expected_path = name.toLowerCase().replace(/[\W]/g, "_") + ".orchest";
  cy.findByTestId(TEST_ID.PIPELINE_PATH_TEXTFIELD)
    .find("input")
    .should("have.value", expected_path);
  if (path !== undefined) {
    cy.findByTestId(TEST_ID.PIPELINE_PATH_TEXTFIELD)
      .type("{selectall}{backspace}")
      .type(path);
  }
  cy.findByTestId(TEST_ID.PIPELINE_CREATE_OK).click();
  cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).should("have.length", 1);
  cy.log("======== Done creating pipeline");
});

// Assumes to be in the pipeline editor, in edit mode (not read-only).
Cypress.Commands.add(
  "createStep",
  (title: string, createNewFile?: boolean, fileName?: string) => {
    cy.log("========= Start creating step");
    cy.location("pathname").should("eq", "/pipeline");
    cy.intercept("POST", /.*/).as("allPosts");
    cy.findByTestId(TEST_ID.STEP_CREATE).should("be.visible").pipe(piped_click);
    cy.findByTestId(TEST_ID.STEP_TITLE_TEXTFIELD)
      .find("input")
      .type("{selectall}{backspace}")
      .type(title);
    cy.wait("@allPosts");

    cy.findByTestId(TEST_ID.FILE_PICKER_FILE_PATH_TEXTFIELD)
      .find("input")
      .focus();
    if (createNewFile) {
      cy.findByTestId(TEST_ID.FILE_PICKER_NEW_FILE).pipe(piped_click);
      cy.findByTestId(
        TEST_ID.PROJECT_FILE_PICKER_CREATE_NEW_FILE_DIALOG
      ).should("be.visible");
      if (fileName !== undefined) {
        cy.findByTestId(TEST_ID.PROJECT_FILE_PICKER_FILE_NAME_TEXTFIELD)
          .type("{selectall}{backspace}")
          .type(fileName);
        cy.wait("@allPosts");
      }
      cy.findByTestId(TEST_ID.PROJECT_FILE_PICKER_CREATE_FILE)
        // Apparently, using a piped_click here won't work, i.e the step
        // will be updated with the new file at the json level, but the
        // UI state will not, the step will still show the placeholder
        // name.
        .should("be.visible")
        .click();
    } else if (fileName !== undefined) {
      cy.findByTestId(TEST_ID.FILE_PICKER_FILE_PATH_TEXTFIELD)
        .type("{selectall}{backspace}")
        .type(fileName);
    }
    cy.wait("@allPosts");
    cy.findByTestId(TEST_ID.STEP_CLOSE_DETAILS)
      .should("be.visible")
      .pipe(piped_click);
    cy.log("========= Done creating step");
  }
);

// Note: currently not idempotent.
Cypress.Commands.add("deleteAllEnvironments", (count?: number) => {
  count = count || 1;
  cy.intercept("DELETE", /.*/).as("allDeletes");
  cy.goToMenu("environments");
  // at least one should appear
  reloadUntilElementsLoaded(
    "environment-list-row",
    () => {
      cy.findByTestId("environment-list").should("exist");
      cy.findByTestId("loading-table-row").should("not.exist");
      return cy.wait(1000);
    },
    count
  );
  cy.findByTestId(TEST_ID.ENVIRONMENTS_TOGGLE_ALL_ROWS)
    .find("input")
    .click({ force: true });
  cy.findByTestId(TEST_ID.ENVIRONMENTS_DELETE).click({ force: true });
  cy.findByTestId(TEST_ID.CONFIRM_DIALOG_OK)
    .click()
    .wait(Array(count).fill("@allDeletes"));
  reloadUntilElementsLoaded(
    "environment-list-row",
    () => {
      cy.findByTestId("environment-list").should("exist");
      cy.findByTestId("loading-table-row").should("not.exist");
      return cy.wait(1000);
    },
    0
  );
});

// Note: currently not idempotent.
Cypress.Commands.add("deleteAllPipelines", () => {
  cy.intercept("DELETE", /.*/).as("allDeletes");
  cy.goToMenu("pipelines");
  // set rows != 0 then deleta
  cy.findByTestId(TEST_ID.PIPELINES_TABLE_TOGGLE_ALL_ROWS).click();
  cy.findByTestId(TEST_ID.PIPELINE_DELETE).click();
  cy.findByTestId(TEST_ID.CONFIRM_DIALOG_OK).click();
  cy.wait("@allDeletes");
});

Cypress.Commands.add("getIframe", (dataTestId: string) => {
  // Simplify the logging to avoid cluttering logs.
  cy.log(`getIframe "${dataTestId}"`);
  return (
    cy
      .get(`iframe[data-test-id="${dataTestId}"]`, { log: false })
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
    .then((body: Array<{ path: string }>) =>
      cy.wrap(body.find((obj) => obj.path === project)[0].uuid as string)
    );
});

Cypress.Commands.add(
  "goToMenu",
  (entry: string, predicate?: (location: Location) => boolean) => {
    cy.log(`======= Start navigating to "/${entry}" via menu`)
      .wrap([
        "projects",
        "pipelines",
        "environments",
        "file_manager",
        "settings",
        "jobs",
      ])
      .should("include", entry);

    cy.findByTestId(`menu-${entry}`).click();

    if (predicate) {
      cy.location().should("satisfy", predicate);
    } else {
      cy.location("pathname").should("equal", `/${entry}`);
    }
    cy.log(`======= Done navigating to "/${entry}" via menu`);
  }
);

//Assumes environment names are unique.
Cypress.Commands.add(
  "getEnvironmentUUID",
  (projectUUID: string, environment: string) => {
    return cy
      .request(`store/environments/${projectUUID}`)
      .its("body")
      .then((body: Array<{ name: string; uuid: string }>) =>
        cy.wrap(body.find((obj) => obj.name === environment).uuid as string)
      );
  }
);

Cypress.Commands.add(
  "totalEnvironmentImages",
  (project?: string, environment?: string) => {
    if (project === undefined && environment === undefined) {
      return cy
        .exec(
          'docker images --filter "label=_orchest_env_build_task_uuid" -q | wc -l',
          { log: false }
        )
        .its("stdout", { log: false })
        .then((stdout) => cy.wrap(parseInt(stdout), { log: true }));
    } else if (project !== undefined && environment === undefined) {
      cy.getProjectUUID(project).then((proj_uuid) => {
        return cy
          .exec(
            `docker images --filter "label=_orchest_project_uuid=${proj_uuid}" -q | wc -l`,
            { log: false }
          )
          .its("stdout", { log: false })
          .then((stdout) => cy.wrap(parseInt(stdout), { log: false }));
      });
    } else if (project !== undefined && environment !== undefined) {
      cy.getProjectUUID(project).then((proj_uuid) => {
        cy.getEnvironmentUUID(proj_uuid, environment).then((env_uuid) => {
          return cy
            .exec(
              `docker images --filter "label=_orchest_environment_uuid=${env_uuid}" -q | wc -l`,
              { log: false }
            )
            .its("stdout", { log: false })
            .then((stdout) => cy.wrap(parseInt(stdout), { log: false }));
        });
      });
    } else {
      throw new Error('"project" must be defined if environment is passed.');
    }
  }
);

// Unhandled promise rejections will cause seemingly random errors that
// are very hard to debug. This will help in understanding if you are
// getting such an error.
Cypress.on("uncaught:exception", (err, runnable, promise) => {
  if (promise) {
    console.log("Unhandled promise rejection.");
    console.log(promise);
    // If false is returned the exception will be ignored and won't
    // cause the test to fail.
    return false;
  }
});
