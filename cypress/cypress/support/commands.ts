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

type TBooleanString = "true" | "false";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
      createProject(path: string): Chainable<void>;
      deleteAllProjects(): Chainable<void>;
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
      disableCheckUpdate(): Chainable<undefined>;
      getEnvironmentUUID(
        projectUUID: string,
        environment: string
      ): Chainable<string>;
      getIframe(dataTestId: string): Chainable<JQuery<any>>;
      getOnboardingCompleted(): Chainable<TBooleanString>;
      getProjectUUID(project: string): Chainable<string>;
      assertInProjectsTable(path: string): Chainable;
      navigateToProjectSettings(path: string): Chainable;
      navigateViaTopMenu(
        to:
          | "pipeline"
          | "jupyter-lab"
          | "jobs"
          | "environments"
          | "settings"
          | "help"
      ): Chainable<string>;
      navigateViaProjectDrawer(to: "projects" | "examples"): Chainable<string>;
      reset(): Chainable<undefined>;
      setOnboardingCompleted(value: TBooleanString): Chainable<undefined>;
      totalEnvironmentImages(
        project?: string,
        environment?: string
      ): Chainable<number>;
      getLocalStorage(key: string): void;
    }
  }
}

Cypress.Commands.add("setOnboardingCompleted", (value: TBooleanString) => {
  cy.setLocalStorage(LOCAL_STORAGE_KEY, value);
  // Needed to close the onboarding modal.
  cy.reload(true);
});

Cypress.Commands.add("disableCheckUpdate", () => {
  // If the latest version can't be fetched, then we will never
  // prompt asking users to update.
  cy.intercept("GET", "/async/orchest-update-info", {
    latest_version: "v2022.01.1",
  });

  cy.intercept("GET", "/async/version", {
    version: "v2022.01.1",
  });
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
  cy.log(`:: Creating project: "${name}".`);

  cy.request("POST", "/async/projects", { name }).as("createProject");
});

Cypress.Commands.add("deleteAllProjects", () => {
  cy.log(":: Deleting all projects!");

  cy.request("GET", "/async/projects")
    .as("projectsToDelete")
    .then((response) => {
      for (const project of response.body) {
        cy.request("DELETE", "/async/projects/" + project.uuid).as(
          "deleteProject"
        );
      }
    });
});

Cypress.Commands.add(
  "addProjectEnvVars",
  (projectPath: string, names: string[], values: string[]) => {
    cy.log(":: Adding project environment variables");
    cy.intercept("PUT", /.*/).as("allPuts");
    assert(names.length === values.length);

    cy.navigateToProjectSettings(projectPath);

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
  }
);

Cypress.Commands.add(
  "addPipelineEnvVars",
  (pipeline: string, names: string[], values: string[]) => {
    assert(names.length == values.length);
    cy.log("======= Start adding pipeline env vars.");
    cy.intercept("PUT", /.*/).as("allPuts");
    cy.navigateViaTopMenu("pipeline");
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
  cy.navigateViaTopMenu("settings");
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
  cy.navigateViaTopMenu("settings");
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
  cy.navigateViaTopMenu("settings");
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
    cy.log("======== Start creating environment");
    cy.intercept("PUT", /.*/).as("allPuts");
    cy.intercept("POST", /.*/).as("allPosts");
    cy.visit("environments");
    cy.findByTestId(TEST_ID.ENVIRONMENTS_CREATE).should("be.visible").click();
    cy.wait("@allPosts");

    cy.get("[data-test-id=environments-env-name] input")
      .should("be.visible")
      .type(`{selectall}{backspace}${name}{enter}`);

    cy.wait("@allPuts");

    if (script !== undefined) {
      let deletions = "{backspace}".repeat(30);
      cy.get(".CodeMirror-line")
        .first()
        .type(deletions + script);
    }
    if (build) {
      cy.findByTestId(TEST_ID.ENVIRONMENT_START_BUILD)
        .scrollIntoView()
        .should("be.visible")
        .click();
      cy.findByTestId(TEST_ID.ENVIRONMENTS_BUILD_STATUS)
        .scrollIntoView()
        .should("be.visible")
        .contains(/Building|Getting ready to build/);
      if (waitBuild) {
        cy.findByTestId(TEST_ID.ENVIRONMENTS_BUILD_STATUS)
          .scrollIntoView()
          .should("be.visible")
          .contains("Build successfully completed!", { timeout: 20000 });
      }
      cy.log("======== Done creating environment");
    }
  }
);

Cypress.Commands.add("createPipeline", (name: string, path?: string) => {
  cy.log("======== Start creating pipeline");
  cy.navigateViaTopMenu("pipeline");
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
  cy.url().should("include", "/pipeline?");
  cy.findByTestId("pipeline-name").contains(name);
  // Expect a session just started. Stop it when it's done starting.
  cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON)
    .contains("Stop session", { timeout: 60000 })
    .click();
  cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains("Start session", {
    timeout: 60000,
  });
  cy.navigateViaTopMenu("pipeline");
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
  cy.navigateViaTopMenu("environments");
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
  cy.navigateViaTopMenu("pipeline");
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
    .then(
      (body: Array<{ uuid: string; path: string }>) =>
        body.filter((obj) => obj.path == project)[0].uuid
    );
});

Cypress.Commands.add("assertInProjectsTable", (path) => {
  cy.navigateViaProjectDrawer("projects");
  cy.findByTestId(TEST_ID.PROJECTS_TABLE_ROW(path))
    .should("be.visible")
    .should("contain.text", path);
});

Cypress.Commands.add("navigateViaProjectDrawer", (entry) => {
  cy.log(`:: Navigating to "${entry}" via the project drawer`);

  cy.findByTestId("project-selector", { timeout: 2500 }).click();
  cy.findByTestId(`project-drawer/${entry}`, { timeout: 2500 }).click();
});

Cypress.Commands.add("navigateViaTopMenu", (entry) => {
  cy.log(`:: Navigating to "${entry}" via the top menu`);

  cy.findByTestId(`top-menu/${entry}`, { timeout: 2500 }).click({
    force: true,
  });
});

Cypress.Commands.add("navigateToProjectSettings", (path) => {
  cy.log(`:: Navigating to project settings of "${path}" using /projects.`);

  cy.navigateViaProjectDrawer("projects");

  cy.findByTestId(TEST_ID.PROJECTS_SETTINGS_BUTTON(path))
    .should("be.visible")
    .click();

  cy.findByTestId(TEST_ID.PROJECT_LIST_CONTEXT_MENU_SETTINGS, {
    timeout: 2500,
  })
    .should("be.visible")
    .click();
});

//Assumes environment names are unique.
Cypress.Commands.add(
  "getEnvironmentUUID",
  (projectUUID: string, environment: string) => {
    return cy
      .request(`store/environments/${projectUUID}`)
      .its("body")
      .then(
        (body: Array<{ name: string; uuid: string }>) =>
          body.filter((obj) => obj.name == environment)[0].uuid
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
