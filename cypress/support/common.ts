export const QUICKSTART_URL = "https://github.com/orchest/quickstart";

export enum TEST_ID {
  ADD_PROJECT = "add-project",
  ADD_USER = "add-user",
  AUTH_ADMIN_IFRAME = "auth-admin-iframe",
  CONFIRM_DIALOG_OK = "confirm-dialog-ok",
  CREATE_PROJECT = "create-project",
  DELETE_PROJECT = "delete-project",
  ENVIRONMENTS_BUILD_STATUS = "environments-build-status",
  ENVIRONMENTS_CANCEL_BUILD = "environments-cancel-build",
  ENVIRONMENTS_CREATE = "environments-create",
  ENVIRONMENTS_DELETE = "environments-delete",
  ENVIRONMENTS_ENV_NAME = "environments-env-name",
  ENVIRONMENTS_ROW = "environments-row",
  ENVIRONMENTS_ROW_CHECKBOX = "environments-row-checkbox",
  ENVIRONMENTS_SAVE = "environments-save",
  ENVIRONMENTS_START_BUILD = "environments-start-build",
  ENVIRONMENTS_TAB_BUILD = "environments-tab-build",
  ENVIRONMENTS_TAB_PROPERTIES = "environments-tab-properties",
  ENVIRONMENTS_TOGGLE_ALL_ROWS = "environments-toggle-all-rows",
  FILE_PICKER_FILE_PATH_TEXTFIELD = "file-picker-file-path-textfield",
  FILE_PICKER_NEW_FILE = "file-picker-new-file",
  IMPORT_PROJECT = "import-project",
  IMPORT_PROJECT_DIALOG = "import-project-dialog",
  IMPORT_PROJECT_OK = "import-project-ok",
  INTERACTIVE_RUN_CANCEL = "interactive-run-cancel",
  INTERACTIVE_RUN_RUN_INCOMING_STEPS = "interactive-run-run-incoming-steps",
  INTERACTIVE_RUN_RUN_SELECTED_STEPS = "interactive-run-run-selected-steps",
  JOB_CREATE = "job-create",
  JOB_CREATE_NAME = "job-create-name",
  JOB_CREATE_OK = "job-create-ok",
  JOB_EDIT_ENV_VAR_ADD = "job-edit-env-var-add",
  JOB_EDIT_ENV_VAR_NAME = "job-edit-env-var-name",
  JOB_EDIT_ENV_VAR_VALUE = "job-edit-env-var-value",
  JOB_EDIT_NAME_TEXTFIELD = "job-edit-name-textfield",
  JOB_EDIT_PIPELINE_RUNS_ROW = "job-edit-pipeline-runs-row",
  JOB_EDIT_SCHEDULE_CRONJOB = "job-edit-schedule-cronjob",
  JOB_EDIT_SCHEDULE_CRONJOB_INPUT = "job-edit-schedule-cronjob-input",
  JOB_EDIT_SCHEDULE_DATE = "job-edit-schedule-date",
  JOB_EDIT_SCHEDULE_DATE_INPUT = "job-edit-schedule-date-input",
  JOB_EDIT_SCHEDULE_DATE_INPUT_DATE = "job-edit-schedule-date-input-date",
  JOB_EDIT_SCHEDULE_DATE_INPUT_TIME = "job-edit-schedule-date-input-time",
  JOB_EDIT_SCHEDULE_NOW = "job-edit-schedule-now",
  JOB_EDIT_TAB_ENVIRONMENT_VARIABLES = "job-edit-tab-environment-variables",
  JOB_EDIT_TAB_PARAMETERS = "job-edit-tab-parameters",
  JOB_EDIT_TAB_PIPELINE_RUNS = "job-edit-tab-pipeline-runs",
  JOB_EDIT_TAB_SCHEDULING = "job-edit-tab-scheduling",
  JOB_ENVIRONMENT_VARIABLES = "job-environment-variables",
  JOB_PARAMETERS = "job-parameters",
  JOB_PIPELINE_RUNS = "job-pipeline-runs",
  JOB_PIPELINE_RUNS_ROW = "job-pipeline-runs-row",
  JOB_REFRESH = "job-refresh",
  JOB_RUN = "job-run",
  JOB_STATUS = "job-status",
  JOB_UPDATE = "job-update",
  JUPYTERLAB_IFRAME = "jupyterlab-iframe",
  MANAGE_USERS = "manage-users",
  NEW_USER_NAME = "new-user-name",
  NEW_USER_PASSWORD = "new-user-password",
  ORCHEST_LOGO = "orchest-logo",
  PIPELINES_TABLE = "pipelines-table",
  PIPELINES_TABLE_ROW = "pipelines-table-row",
  PIPELINES_TABLE_TOGGLE_ALL_ROWS = "pipelines-table-toggle-all-rows",
  PIPELINE_BACK_TO_JOB = "pipeline-back-to-job",
  PIPELINE_CENTER = "pipeline-center",
  PIPELINE_CREATE = "pipeline-create",
  PIPELINE_CREATE_OK = "pipeline-create-ok",
  PIPELINE_DELETE = "pipeline-delete",
  PIPELINE_EDIT_PATH = "pipeline-edit-path",
  PIPELINE_EDIT_PATH_SAVE = "pipeline-edit-path-save",
  PIPELINE_EDIT_PATH_TEXTFIELD = "pipeline-edit-path-textfield",
  PIPELINE_ENV_VAR_ADD = "pipeline-env-var-add",
  PIPELINE_ENV_VAR_NAME = "pipeline-env-var-name",
  PIPELINE_ENV_VAR_VALUE = "pipeline-env-var-value",
  PIPELINE_NAME_TEXTFIELD = "pipeline-name-textfield",
  PIPELINE_PATH_TEXTFIELD = "pipeline-path-textfield",
  PIPELINE_SETTINGS = "pipeline-settings",
  PIPELINE_SETTINGS_CLOSE = "pipeline-settings-close",
  PIPELINE_SETTINGS_CONFIGURATION_MEMORY_EVICTION = "pipeline-settings-configuration-memory-eviction",
  PIPELINE_SETTINGS_CONFIGURATION_MEMORY_SIZE = "pipeline-settings-configuration-memory-size",
  PIPELINE_SETTINGS_CONFIGURATION_PIPELINE_NAME = "pipeline-settings-configuration-pipeline-name",
  PIPELINE_SETTINGS_CONFIGURATION_RESTART_MEMORY_SERVER = "pipeline-settings-configuration-restart-memory-server",
  PIPELINE_SETTINGS_SAVE = "pipeline-settings-save",
  PIPELINE_SETTINGS_TAB_CONFIGURATION = "pipeline-settings-tab-configuration",
  PIPELINE_SETTINGS_TAB_ENVIRONMENT_VARIABLES = "pipeline-settings-tab-environment-variables",
  PIPELINE_SETTINGS_TAB_SERVICES = "pipeline-settings-tab-services",
  PIPELINE_STEP = "pipeline-step",
  PROJECTS_TABLE_ROW = "projects-table-row",
  PROJECTS_TABLE_TOGGLE_ALL_ROWS = "projects-table-toggle-all-rows",
  PROJECT_ENV_VAR_ADD = "project-env-var-add",
  PROJECT_ENV_VAR_NAME = "project-env-var-name",
  PROJECT_ENV_VAR_VALUE = "project-env-var-value",
  PROJECT_FILE_PICKER = "project-file-picker",
  PROJECT_FILE_PICKER_CREATE_FILE = "project-file-picker-create-file",
  PROJECT_FILE_PICKER_CREATE_NEW_FILE = "project-file-picker-create-new-file",
  PROJECT_FILE_PICKER_CREATE_NEW_FILE_DIALOG = "project-file-picker-create-new-file-dialog",
  PROJECT_FILE_PICKER_FILE_NAME_TEXTFIELD = "project-file-picker-file-name-textfield",
  PROJECT_FILE_PICKER_FILE_PATH_TEXTFIELD = "project-file-picker-file-path-textfield",
  PROJECT_NAME_TEXTFIELD = "project-name-textfield",
  PROJECT_SETTINGS_SAVE = "project-settings-save",
  PROJECT_URL_TEXTFIELD = "project-url-textfield",
  RESTART = "restart",
  SESSION_TOGGLE_BUTTON = "session-toggle-button",
  STEP_CLOSE_DETAILS = "step-close-details",
  STEP_CREATE = "step-create",
  STEP_DELETE = "step-delete",
  STEP_DELETE_MULTI = "step-delete-multi",
  STEP_FILE_NAME_TEXTFIELD = "step-file-name-textfield",
  STEP_TITLE_TEXTFIELD = "step-title-textfield",
  STEP_VIEW_FILE = "step-view-file",
  STEP_VIEW_IN_JUPYTERLAB = "step-view-in-jupyterlab",
  SWITCH_TO_JUPYTERLAB = "switch-to-jupyterlab",
}

export const LOCAL_STORAGE_KEY = "orchest.onboarding_completed";
export const DATA_DIR = "userdir/data";
export const PROJECTS_DIR = "userdir/projects";
export const TESTS_DATA_DIR = DATA_DIR + "/integration-tests";

const FIXTURE_STEPS_PATH = "cypress/fixtures/custom/steps/";
const FIXTURE_PIPELINES_PATH = "cypress/fixtures/custom/pipelines/";
const FIXTURE_PROJECTS_PATH = "cypress/fixtures/custom/projects/";
const DEFAULT_STEP_TEST_OUT = "test-output.json";
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
};

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
export function assertTotalEnvironmentImages(expected: number, retries = 10) {
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
