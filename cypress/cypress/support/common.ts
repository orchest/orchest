export const QUICKSTART_URL = "https://github.com/orchest/quickstart";

// These can be used to have names when creating entities without having
// to come up with a name every time.
export enum SAMPLE_PROJECT_NAMES {
  P1 = "test-project-1",
  P2 = "test-project-2",
}

export enum SAMPLE_PIPELINE_NAMES {
  PL1 = "test-pipeline-1",
  PL2 = "test-pipeline-2",
}

export enum SAMPLE_STEP_NAMES {
  ST1 = "test-step-1",
  ST2 = "test-step-2",
}

export enum SAMPLE_JOB_NAMES {
  J1 = "job-1",
}

export enum JOB_STATUS {
  ABORTED = "This job was cancelled",
  PENDING = "Some pipeline runs haven't completed yet",
  FAILURE = "All pipeline runs were unsuccessful",
  STARTED = "This job is running",
  SUCCESS = "All pipeline runs were successful",
  MIXED_PENDING = "Some pipeline runs haven't completed yet",
  MIXED_FAILURE = "Some pipeline runs were unsuccessful",
}

export const TEST_ID = {
  PROJECT_SELECTOR_MENU_NEW_PROJECT_BUTTON:
    "project-selector-menu-new-project-button",
  ADD_USER: "add-user",
  AUTH_ADMIN_IFRAME: "auth-admin-iframe",
  CONFIRM_DIALOG_OK: "confirm-dialog-ok",
  PROJECTS_HEADER_IMPORT_BUTTON: "projects-header-import-button",
  PROJECTS_HEADER_NEW_PROJECT_BUTTON: "projects-header-new-project-button",
  PROJECT_EMPTY_STATE_NEW_PROJECT_BUTTON:
    "project-empty-state-new-project-button",
  PROJECT_EMPTY_STATE_IMPORT_BUTTON: "project-empty-state-import-button",
  CREATE_PROJECT_DIALOG: "create-project-dialog",
  CREATE_PROJECT_DIALOG_SUBMIT_BUTTON: "create-project-dialog-submit-button",
  PROJECTS_TABLE_ROWS: "projects-table-rows",
  PROJECTS_TABLE_ROW: (path: string) => `projects-table-row-${path}`,
  PROJECTS_SETTINGS_BUTTON: (path: string) => `project-settings-button-${path}`,
  PROJECT_LIST_CONTEXT_MENU: "project-list-context-menu",
  PROJECT_LIST_CONTEXT_MENU_SETTINGS: "project-list-context-menu-settings",
  PROJECT_LIST_CONTEXT_MENU_RENAME: "project-list-context-menu-rename",
  PROJECT_LIST_CONTEXT_MENU_DELETE: "project-list-context-menu-delete",
  ENVIRONMENTS_BUILD_STATUS: "environments-build-status",
  ENVIRONMENTS_CANCEL_BUILD: "environments-cancel-build",
  ENVIRONMENTS_CREATE: "environments-create",
  ENVIRONMENTS_DELETE: "environment-list-delete",
  ENVIRONMENTS_ENV_NAME: "environments-env-name",
  ENVIRONMENTS_ROW: "environment-list-row",
  ENVIRONMENTS_ROW_CHECKBOX: "environments-row-checkbox",
  ENVIRONMENTS_SAVE: "environments-save",
  ENVIRONMENT_START_BUILD: "environment-start-build",
  ENVIRONMENT_TAB_PROPERTIES: "environment-properties-tab",
  ENVIRONMENTS_TOGGLE_ALL_ROWS: "environment-list-toggle-all-rows",
  FILE_PICKER_FILE_PATH_TEXTFIELD: "file-picker-file-path-textfield",
  FILE_PICKER_NEW_FILE: "file-picker-new-file",
  IMPORT_PROJECT_DIALOG: "import-project-dialog",
  IMPORT_PROJECT_DIALOG_NEXT_BUTTON: "import-project-dialog-next-button",
  IMPORT_PROJECT_DIALOG_CLOSE_BUTTON: "import-project-dialog-close-button",
  IMPORT_SUCCESS_DIALOG_CLOSE_BUTTON: "import-success-dialog-close-button",
  IMPORT_SUCCESS_DIALOG_VIEW_PIPELINE_BUTTON:
    "import-success-dialog-view-pipeline-button",
  INTERACTIVE_RUN_CANCEL: "interactive-run-cancel",
  INTERACTIVE_RUN_RUN_INCOMING_STEPS: "interactive-run-run-incoming-steps",
  INTERACTIVE_RUN_RUN_SELECTED_STEPS: "interactive-run-run-selected-steps",
  JOB_CREATE: "job-create",
  JOB_CREATE_NAME: "job-create-name",
  JOB_CREATE_OK: "job-create-ok",
  JOB_EDIT_ENV_VAR_ADD: "job-edit-env-var-add",
  JOB_EDIT_ENV_VAR_NAME: "job-edit-env-var-name",
  JOB_EDIT_ENV_VAR_VALUE: "job-edit-env-var-value",
  JOB_EDIT_NAME_TEXTFIELD: "job-edit-name-textfield",
  JOB_EDIT_PIPELINE_RUNS_ROW: "job-edit-pipeline-runs-row",
  JOB_EDIT_SCHEDULE_CRONJOB: "job-edit-schedule-cronjob",
  JOB_EDIT_SCHEDULE_CRONJOB_INPUT: "job-edit-schedule-cronjob-input",
  JOB_EDIT_SCHEDULE_DATE: "job-edit-schedule-date",
  JOB_EDIT_SCHEDULE_DATE_INPUT: "job-edit-schedule-date-input",
  JOB_EDIT_SCHEDULE_DATE_INPUT_DATE: "job-edit-schedule-date-input-date",
  JOB_EDIT_SCHEDULE_DATE_INPUT_TIME: "job-edit-schedule-date-input-time",
  JOB_EDIT_SCHEDULE_NOW: "job-edit-schedule-now",
  JOB_EDIT_TAB_ENVIRONMENT_VARIABLES: "environment-variables-tab",
  JOB_EDIT_TAB_PARAMETERS: "parameters-tab",
  JOB_EDIT_TAB_PIPELINE_RUNS: "runs-tab",
  JOB_EDIT_TAB_SCHEDULING: "scheduling-tab",
  JOB_ENVIRONMENT_VARIABLES: "job-environment-variables",
  JOB_PARAMETERS: "job-parameters",
  JOB_PIPELINE_RUNS: "job-pipeline-runs",
  JOB_PIPELINE_RUNS_ROW: "job-pipeline-runs-row",
  JOB_REFRESH: "job-refresh",
  JOB_RUN: "job-run",
  JOB_STATUS: "job-status",
  JOB_UPDATE: "job-update",
  JUPYTERLAB_IFRAME: "jupyterlab-iframe",
  MANAGE_USERS: "manage-users",
  TOP_MENU_ENVIRONMENTS: "top-menu/environments",
  TOP_MENU_JOBS: "top-menu/jobs",
  TOP_MENU_PIPELINE: "top-menu/pipelines",
  TOP_MENU_SETTINGS: "top-menu/settings",
  NEW_USER_NAME: "new-user-name",
  NEW_USER_PASSWORD: "new-user-password",
  ONBOARDING_CLOSE: "onboarding-close",
  ONBOARDING_COMPLETE_WITHOUT_QUICKSTART:
    "onboarding-complete-without-quickstart",
  ONBOARDING_COMPLETE_WITH_QUICKSTART: "onboarding-complete-with-quickstart",
  ONBOARDING_DIALOG_CONTENT: "onboarding-dialog-content",
  ONBOARDING_INDICATOR_BUTTON: "onboarding-indicator-button",
  ONBOARDING_INDICATOR_LIST: "onboarding-indicator-list",
  ONBOARDING_INDICATOR_LIST_ITEM: "onboarding-indicator-list-item",
  ONBOARDING_NEXT: "onboarding-next",
  ONBOARDING_OPEN: "onboarding-open",
  ONBOARDING_SLIDE: "onboarding-slide",
  ORCHEST_LOGO: "orchest-logo",
  PIPELINES_TABLE: "pipelines-table",
  PIPELINES_TABLE_ROW: "pipeline-list-row",
  PIPELINES_TABLE_TOGGLE_ALL_ROWS: "pipeline-list-toggle-all-rows",
  PIPELINE_BACK_TO_JOB: "pipeline-back-to-job",
  PIPELINE_CENTER: "pipeline-center",
  PIPELINE_CREATE: "pipeline-create",
  PIPELINE_CREATE_OK: "pipeline-create-ok",
  PIPELINE_DELETE: "pipeline-list-delete",
  PIPELINE_EDIT_PATH: "pipeline-edit-path",
  PIPELINE_EDIT_PATH_SAVE: "pipeline-edit-path-save",
  PIPELINE_EDIT_PATH_TEXTFIELD: "pipeline-edit-path-textfield",
  PIPELINE_ENV_VAR_ADD: "pipeline-env-var-add",
  PIPELINE_ENV_VAR_NAME: "pipeline-env-var-name",
  PIPELINE_ENV_VAR_VALUE: "pipeline-env-var-value",
  PIPELINE_NAME_TEXTFIELD: "pipeline-name-textfield",
  PIPELINE_PATH_TEXTFIELD: "pipeline-path-textfield",
  PIPELINE_SERVICES_ROW: "service-list-row",
  PIPELINE_SERVICE_ADD: "pipeline-service-add",
  PIPELINE_SETTINGS: "pipeline-settings",
  PIPELINE_SETTINGS_CLOSE: "pipeline-settings-close",
  PIPELINE_SETTINGS_CONFIGURATION_MEMORY_EVICTION:
    "pipeline-settings-configuration-memory-eviction",
  PIPELINE_SETTINGS_CONFIGURATION_MEMORY_SIZE:
    "pipeline-settings-configuration-memory-size",
  PIPELINE_SETTINGS_CONFIGURATION_PIPELINE_NAME:
    "pipeline-settings-configuration-pipeline-name",
  PIPELINE_SETTINGS_CONFIGURATION_RESTART_MEMORY_SERVER:
    "pipeline-settings-configuration-restart-memory-server",
  PIPELINE_SETTINGS_SAVE: "pipeline-settings-save",
  PIPELINE_SETTINGS_TAB_CONFIGURATION: "configuration-tab",
  PIPELINE_SETTINGS_TAB_ENVIRONMENT_VARIABLES: "environment-variables-tab",
  PIPELINE_SETTINGS_TAB_SERVICES: "services-tab",
  PIPELINE_STEP: "pipeline-step",
  PROJECTS_TABLE_TOGGLE_ALL_ROWS: "project-list-toggle-all-rows",
  PROJECT_ENV_VAR_ADD: "project-env-var-add",
  PROJECT_ENV_VAR_NAME: "project-env-var-name",
  PROJECT_ENV_VAR_VALUE: "project-env-var-value",
  PROJECT_FILE_PICKER: "project-file-picker",
  PROJECT_FILE_PICKER_CREATE_FILE: "project-file-picker-create-file",
  PROJECT_FILE_PICKER_CREATE_NEW_FILE: "project-file-picker-create-new-file",
  PROJECT_FILE_PICKER_CREATE_NEW_FILE_DIALOG:
    "project-file-picker-create-new-file-dialog",
  PROJECT_FILE_PICKER_FILE_NAME_TEXTFIELD:
    "project-file-picker-file-name-textfield",
  PROJECT_FILE_PICKER_FILE_PATH_TEXTFIELD:
    "project-file-picker-file-path-textfield",
  IMPORT_DIALOG_NAME_INPUT: "import-dialog-name-input",
  CREATE_PROJECT_DIALOG_NAME_INPUT: "create-project-dialog-name-input",
  PROJECT_SETTINGS_SAVE: "project-settings-save",
  PROJECT_URL_TEXTFIELD: "project-url-textfield",
  RESTART: "restart",
  SERVICE_IMAGE_NAME_DIALOG_IMAGE_NAME: "service-image-name-dialog-image-name",
  SERVICE_IMAGE_NAME_DIALOG_SAVE: "service-image-name-dialog-save",
  SESSION_TOGGLE_BUTTON: "session-toggle-button",
  STEP_CLOSE_DETAILS: "step-close-details",
  STEP_CREATE: "step-create",
  STEP_DELETE: "step-delete",
  STEP_DELETE_MULTI: "step-delete-multi",
  STEP_FILE_NAME_TEXTFIELD: "step-file-name-textfield",
  STEP_TITLE_TEXTFIELD: "step-title-textfield",
  STEP_VIEW_FILE: "step-view-file",
  STEP_VIEW_IN_JUPYTERLAB: "step-view-in-jupyterlab",
  SWITCH_TO_JUPYTERLAB: "switch-to-jupyterlab",
};

export const LOCAL_STORAGE_KEY = "orchest.onboarding_completed";
export const DATA_DIR = "../userdir/data";
export const PROJECTS_DIR = "../userdir/projects";
export const JOBS_DIR = "../userdir/jobs/";
export const TESTS_DATA_DIR = DATA_DIR + "/integration-tests";

const FIXTURE_STEPS_PATH = "cypress/fixtures/custom/steps/";
const FIXTURE_PIPELINES_PATH = "cypress/fixtures/custom/pipelines/";
const FIXTURE_PROJECTS_PATH = "cypress/fixtures/custom/projects/";
const DEFAULT_STEP_TEST_OUT = "test-output.json";

/*
STEPS, PIPELINES and PROJECTS are fixtures that can be found in the
cypress/fixtures directory. These can be copied into a project or into
the projects directory to quickly setup a step/pipeline/project with the
functionalities required by some tests. For example, some tests require
the data-passing project, so said project is simply copied in the
projects directory during the `beforeEach` of said tests.
*/
export const STEPS = {
  // A step that dumps its environment variables, step and pipeline
  // parameters in the data directory as a json file. The path of the
  // file, relative to the data directory, can be set by passing the
  // parameter test_output_file to the step, defaults to
  // DEFAULT_STEP_TEST_OUT.
  DUMP_ENV_PARAMS: {
    name: "dump-env-params.ipynb",
    default_output_file: `${DATA_DIR}/${DEFAULT_STEP_TEST_OUT}`,
    get_path: function () {
      return `${FIXTURE_STEPS_PATH}/${this.name}`;
    },
  },
};

export const PIPELINES = {
  // A pipeline composed of two steps, A and B. A looks into its step
  // parameters for "input_data" and "input_data_name". input_data must
  // be parseable to a json, input_data_name is optional. Given these 2
  // parameters, the step will output (orchest.output(data, name)) the
  // given data. Step B reads input data(orchest.get_input()) and dumps
  // it as a json file in the data directory. The path of the file,
  // relative to the data directory, can be set by passing the parameter
  // test_output_file to the step, defaults to DEFAULT_STEP_TEST_OUT.
  DATA_PASSING: {
    name: "data-passing",
    default_output_file: `${DATA_DIR}/${DEFAULT_STEP_TEST_OUT}`,
    get_path: function () {
      return `${FIXTURE_PIPELINES_PATH}/${this.name}`;
    },
  },

  // The DUMP_ENV_PARAMS step "wrapped" in a pipeline, both the step and
  // the pipeline have existing parameters for ease of use in jobs (and
  // other) tests.
  DUMP_ENV_PARAMS: {
    name: "dump-env-params",
    default_output_file: `${DATA_DIR}/${DEFAULT_STEP_TEST_OUT}`,
    get_path: function () {
      return `${FIXTURE_PIPELINES_PATH}/${this.name}`;
    },
  },
};

export const PROJECTS = {
  // The DATA_PASSING pipeline "wrapped" in a project, steps have
  // defined parameters and an environment is already defined for ease
  // of use in jobs (and other) tests.
  DATA_PASSING: {
    name: "data-passing",
    pipelines: ["data-passing"],
    default_output_file: `${DATA_DIR}/${DEFAULT_STEP_TEST_OUT}`,
    get_path: function () {
      return `${FIXTURE_PROJECTS_PATH}/${this.name}`;
    },
  },

  // The DUMP_ENV_PARAMS step "wrapped" in a project, both the step and
  // the pipeline have existing parameters and an environment is already
  // defined for ease of use in jobs (and other) tests.
  DUMP_ENV_PARAMS: {
    name: "dump-env-params",
    pipelines: ["dump-env-params"],
    default_output_file: `${DATA_DIR}/${DEFAULT_STEP_TEST_OUT}`,
    get_path: function () {
      return `${FIXTURE_PROJECTS_PATH}/${this.name}`;
    },
  },

  // Contains a custom environment, a pipeline containing all pre-made
  // services and a step which tests internal connectivity and dumps
  // said result along with the list of external URLs to test
  // connectivity to.
  SERVICES_CONNECTIVITY: {
    name: "services-connectivity",
    pipelines: ["services-connectivity"],
    default_output_file: `${DATA_DIR}/${DEFAULT_STEP_TEST_OUT}`,
    get_path: function () {
      return `${FIXTURE_PROJECTS_PATH}/${this.name}`;
    },
  },
};

// This function is necessary because, as of now, cypress does not
// support retry-ability of custom commands. It can hacked into but not
// if you need to use cypress commands within the custom command. We
// need to use cy.exec to run system commands, and it is one of the few
// cypress commands that does not have retry-ability when following
// assertions fail.
/**
 * @param expected {number} Expected number of environment images.
 * @param retries {number} How many times to retry if expected != value.
 */
export function assertTotalEnvironmentImages(expected: number, retries = 50) {
  cy.log(`Asserting that the number of environment images is ${expected}.`);
  cy.totalEnvironmentImages().then((total) => {
    if (total !== expected) {
      retries--;
      if (retries > 0) {
        cy.wait(200, { log: false });
        assertTotalEnvironmentImages(expected, retries);
      } else {
        throw new Error(
          `Total environment images: expected ${expected}, total ${total}`
        );
      }
    }
  });
}

export function getJobProjectDirPath(
  projectUUID: string,
  pipelineUUID: string,
  jobUUID: string,
  runUUID?: string
) {
  let r = `${JOBS_DIR}/${projectUUID}/${pipelineUUID}/${jobUUID}`;
  if (runUUID === undefined) {
    r += "/snapshot";
  } else {
    r += `/${runUUID}`;
  }
  return r;
}

export function setStepParameters(stepTitle: string, params) {
  cy.intercept("POST", /async\/project-files\/exists/).as("fileExists");
  cy.get(`[data-test-title=${stepTitle}]`)
    .scrollIntoView()
    .click({ force: true });
  cy.wait("@fileExists");

  cy.intercept("POST", /.*/).as("allPosts");
  // Delete the current content.
  cy.get(".CodeMirror-line")
    .first()
    .click()
    // Note that doing a {selectall} followed by a {backspace} does not
    // seem to work, it results in the parameters we are typing next
    // being "mangled", i.e. initial chars randomly disappearing.
    .type("{backspace}".repeat(20));
  // Write our params.
  cy.get(".CodeMirror-line")
    .first()
    .click()
    .type(`${JSON.stringify(params)}`, {
      parseSpecialCharSequences: false,
    });
  cy.wait("@allPosts");
}

// Converts dateTime to a string in the format YYYY-MM-DD required by
// the job creation view.
export function dateTimeToInputString(dateTime: Date) {
  return new Date(dateTime.getTime() - dateTime.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
}

// Assumes to be in a JobView.
export function waitForJobStatus(expected: string, retries = 100) {
  cy.location("pathname").should("eq", "/job");
  cy.findByTestId(TEST_ID.JOB_STATUS).then((statusElement) => {
    // If the status if not the expected one, try again.
    if (statusElement.text().indexOf(expected) === -1) {
      retries--;
      if (retries > 0) {
        cy.findByTestId(TEST_ID.JOB_REFRESH).click();
        cy.wait(200);
        waitForJobStatus(expected, retries);
      } else {
        throw new Error(`Job never reached a status of "${expected}".`);
      }
    }
  });
}

export function reloadUntilElementsLoaded(
  testId: string,
  isPageLoaded: () => Cypress.Chainable<any> = () => cy.wrap(undefined),
  numberOfElements = 1,
  retries = 10
) {
  cy.reload(true);
  return isPageLoaded().then(() => {
    // NOTE: if we use cy.find, it will fail and discontinue the test when no element is found.
    // therefore, we need to use jQuery to get the elements synchronously
    // and retry conditionally
    const listLength = Cypress.$(`[data-test-id='${testId}']`).length;
    if (
      listLength < numberOfElements ||
      (numberOfElements === 0 && listLength > numberOfElements) // in case of deleting
    ) {
      retries--;
      if (retries > 0) {
        return reloadUntilElementsLoaded(
          testId,
          isPageLoaded,
          numberOfElements,
          retries
        );
      } else {
        throw new Error(
          `${testId} are not loaded. (expected: ${numberOfElements}, actual: ${listLength} )`
        );
      }
    } else {
      cy.wrap(numberOfElements).should("equal", listLength);
    }
  });
}

// Assumes to be in a JobView.
export function waitForJobRunsStatus(
  expectedStatus: string,
  expectedNumberOfRuns: number,
  retries = 100,
  callback?: () => void
) {
  cy.location("pathname").should("eq", "/job");
  let passingRuns = [];
  return cy
    .findAllByTestId(TEST_ID.JOB_PIPELINE_RUNS_ROW)
    .each((run) => {
      if (run.text().indexOf(expectedStatus) !== -1) {
        passingRuns.push(run);
      }
    })
    .wrap(passingRuns)
    .then((passingRuns) => {
      cy.log(`Number of passing runs: ${passingRuns.length}`);
      if (passingRuns.length !== expectedNumberOfRuns) {
        retries--;
        if (retries > 0) {
          cy.findByTestId(TEST_ID.JOB_REFRESH).click();
          cy.wait(200);
          waitForJobRunsStatus(
            expectedStatus,
            expectedNumberOfRuns,
            retries,
            callback
          );
        } else {
          throw new Error(
            `There weren't ${expectedNumberOfRuns} job runs with state "${expectedStatus}".`
          );
        }
      } else {
        cy.wrap(expectedNumberOfRuns).should("equal", passingRuns.length);
        if (callback !== undefined) {
          callback();
        }
      }
    });
}

// Assumes paramName is unique across steps/pipeline params.
export function setJobParameter(
  paramName: string,
  paramValues: (string | number | Record<string, any>)[]
) {
  cy.findByTestId(TEST_ID.JOB_EDIT_TAB_PARAMETERS).click();
  cy.location("pathname").should("eq", "/edit-job");
  cy.findByTestId(`job-edit-parameter-row-${paramName}-value`).click();

  // Delete the current content.
  cy.get(".CodeMirror-line")
    .first()
    .click()
    // Note that doing a {selectall} followed by a {backspace} does not
    // seem to work, it results in the parameters we are typing next
    // being "mangled", i.e. initial chars randomly disappearing.
    .type("{backspace}".repeat(20));
  // Write our params.
  cy.get(".CodeMirror-line")
    .first()
    .click()
    .type(`${JSON.stringify(paramValues)}`, {
      parseSpecialCharSequences: false,
    });
}

// Waits for JupyterLab to actually have loaded.
export function waitForJupyterlab() {
  cy.getIframe(TEST_ID.JUPYTERLAB_IFRAME)
    .contains("Kernel", { timeout: 60000 })
    .should("be.visible");
}

// Merges the provided env variables into a single object.  Expects a
// list of lists of length 2, where the first element is a list of env
// var names and the second element is a list of env var values.
// Priority is given to values later in the list, i.e. collision are
// resolved by giving priority to the newest value.
export function mergeEnvVariables(envVariables: string[][][]) {
  let expectedEnv = {};
  envVariables.forEach((namesValuesPair) => {
    let names = namesValuesPair[0];
    for (let i = 0; i < names.length; i++) {
      expectedEnv[names[i]] = namesValuesPair[1][i];
    }
  });
  return expectedEnv;
}

// Currently looks for at least an environment being built since all
// tests are operating under a single environment.
export function assertEnvIsBuilt() {
  // Make sure the environment is built.
  cy.navigateViaTopMenu("environments");
  cy.findAllByTestId(TEST_ID.ENVIRONMENTS_ROW).click();
  cy.findByTestId(TEST_ID.ENVIRONMENTS_BUILD_STATUS)
    .scrollIntoView()
    .should("be.visible")
    .contains("Build successfully completed!", { timeout: 20000 });

  cy.navigateViaTopMenu("pipeline");
}

export function reset() {
  cy.cleanDataDir();
  cy.cleanProjectsDir();
  // Force rediscovery of deleted projects.
  cy.visit("/projects", { log: false });
  assertTotalEnvironmentImages(0);
}

// Used in conjunction with cypress-pipe as an attempt to fix DOM
// detachment and focus trap issues. See
// https://github.com/cypress-io/cypress/issues/7306
export const piped_click = ($el) => $el.click();
