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
  ENVIRONMENTS_TAB_BUILD = "environments-tab-Build",
  ENVIRONMENTS_TAB_PROPERTIES = "environments-tab-Properties",
  ENVIRONMENTS_TOGGLE_ALL_ROWS = "environments-toggle-all-rows",
  FILE_PICKER_FILE_PATH_TEXTFIELD = "file-picker-file-path-textfield",
  FILE_PICKER_NEW_FILE = "file-picker-new-file",
  IMPORT_PROJECT = "import-project",
  IMPORT_PROJECT_DIALOG = "import-project-dialog",
  IMPORT_PROJECT_OK = "import-project-ok",
  INTERACTIVE_RUN_CANCEL = "interactive-run-cancel",
  INTERACTIVE_RUN_RUN_INCOMING_STEPS = "interactive-run-run-incoming-steps",
  INTERACTIVE_RUN_RUN_SELECTED_STEPS = "interactive-run-run-selected-steps",
  MANAGE_USERS = "manage-users",
  NEW_USER_NAME = "new-user-name",
  NEW_USER_PASSWORD = "new-user-password",
  ORCHEST_LOGO = "orchest-logo",
  PIPELINES_TABLE = "pipelines-table",
  PIPELINE_STEP = "pipeline-step",
  PIPELINES_TABLE_ROW = "pipelines-table-row",
  PIPELINES_TABLE_TOGGLE_ALL_ROWS = "pipelines-table-toggle-all-rows",
  PIPELINE_CREATE = "pipeline-create",
  PIPELINE_CREATE_OK = "pipeline-create-ok",
  PIPELINE_DELETE = "pipeline-delete",
  PIPELINE_EDIT_PATH = "pipeline-edit-path",
  PIPELINE_EDIT_PATH_SAVE = "pipeline-edit-path-save",
  PIPELINE_EDIT_PATH_TEXTFIELD = "pipeline-edit-path-textfield",
  PIPELINE_NAME_TEXTFIELD = "pipeline-name-textfield",
  PIPELINE_PATH_TEXTFIELD = "pipeline-path-textfield",
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
  JUPYTERLAB_IFRAME = "jupyterlab-iframe",
}

export const LOCAL_STORAGE_KEY = "orchest.onboarding_completed";
export const DATA_DIR = "userdir/data";
export const PROJECTS_DIR = "userdir/projects";
export const TESTS_DATA_DIR = DATA_DIR + "/integration-tests";

const FIXTURE_STEPS_PATH = "cypress/fixtures/custom/steps/";
const DEFAULT_STEP_TEST_OUT = "test-output.json";
export const STEPS = {
  DUMP_ENV_PARAMS: {
    name: "dump-env-params.ipynb",
    default_output_file: `${DATA_DIR}/${DEFAULT_STEP_TEST_OUT}`,
    get_path: function () {
      return `${FIXTURE_STEPS_PATH}/${this.name}`;
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
