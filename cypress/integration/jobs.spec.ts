import * as deepEqual from "deep-equal";
import { TEST_ID, STEPS, PROJECTS, DATA_DIR } from "../support/common";

enum JOB_NAMES {
  J1 = "job-1",
}

enum JOB_STATUS {
  ABORTED = "This job was cancelled",
  PENDING = "Some pipeline runs haven't completed yet",
  FAILURE = "All pipeline runs were unsuccessful",
  STARTED = "This job is running",
  SUCCESS = "All pipeline runs were successful",
  MIXED_PENDING = "Some pipeline runs haven't completed yet",
  MIXED_FAILURE = "Some pipeline runs were unsuccessful",
}

// Assumes to be in a JobView.
function waitForJobStatus(expected: string, retries = 100) {
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

// Assumes to be in a JobView.
function waitForJobRunsStatus(
  expectedStatus: string,
  expectedNumberOfRuns: number,
  retries = 50,
  callback?: Function
) {
  let passingRuns = [];
  cy.findAllByTestId(TEST_ID.JOB_PIPELINE_RUNS_ROW)
    .each((run) => {
      if (run.text().indexOf(expectedStatus) !== -1) {
        passingRuns.push(run);
      }
    })
    .wrap(passingRuns)
    .then((passingRuns) => {
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
        if (callback !== undefined) {
          callback();
        }
      }
    });
}

function dateTimeToInputString(dateTime: Date) {
  return new Date(dateTime.getTime() - dateTime.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
}

// Assumes paramName is unique across steps/pipeline params.
function setParameter(paramName: string, paramValues: object) {
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

// Assumes to be in a JobView and that all runs can have their pipeline
// view available, thus requiring the run to be started or in an end
// state. Note that it currently supports parameters from 1 step.
function verifyJobRunsParameters(stepName: string, expectedParameters: {}[]) {
  let foundParamsIndexes = new Set();
  cy.findAllByTestId(TEST_ID.JOB_PIPELINE_RUNS_ROW)
    .its("length")
    .then((numRuns) => {
      for (let index = 0; index < numRuns; index++) {
        // Get into the pipeline view.
        cy.get(`[data-test-index=${TEST_ID.JOB_PIPELINE_RUNS_ROW}-${index}]`)
          .scrollIntoView()
          .click();
        cy.findByTestId(`job-pipeline-runs-row-view-pipeline-${index}`)
          .scrollIntoView()
          .click();
        // Get the step parameters.
        cy.get(`[data-test-title=${stepName}`).scrollIntoView().click({
          force: true,
        });
        cy.get(".CodeMirror-line")
          .invoke("text")
          .then((json) => {
            return JSON.parse(json);
          })
          .then((stepParams) => {
            // Close the step panel.
            cy.get("body").trigger("keydown", { keyCode: 27 });
            cy.wait(100);
            cy.get("body").trigger("keyup", { keyCode: 27 });

            // Get the pipeline parameters.
            cy.findByTestId(TEST_ID.PIPELINE_SETTINGS).click();
            cy.get(".CodeMirror-line")
              .invoke("text")
              .then((json) => {
                return JSON.parse(json);
              })
              .then((pipelineParams) => {
                let runParameters = {
                  stepParams: stepParams,
                  pipelineParams: pipelineParams,
                };
                // Check if these parameters were expected.
                let objIndex = expectedParameters.findIndex((x) =>
                  deepEqual(x, runParameters)
                );
                if (objIndex !== -1) {
                  foundParamsIndexes.add(objIndex);
                }
                // If all runs have been checked and some parameters haven't
                // been found trigger an error.
                if (
                  index === numRuns - 1 &&
                  foundParamsIndexes.size !== numRuns
                ) {
                  throw new Error(
                    `Could not find all job runs parameters.\n${expectedParameters}\n${foundParamsIndexes}`
                  );
                }

                cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_CLOSE).click();
                cy.findByTestId(TEST_ID.PIPELINE_BACK_TO_JOB).click();
              });
          });
      }
    });
}

describe("jobs", () => {
  beforeEach(() => {
    cy.setOnboardingCompleted("true");
  });

  context("requires the dump-env-params pipeline ", () => {
    beforeEach(() => {
      // Copy the pipeline.
      cy.exec(`cp -r ${PROJECTS.DUMP_ENV_PARAMS.get_path()} userdir/projects/`);
      // To trigger the project discovery.
      cy.visit("/projects");
      cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should("have.length", 1);
      // Make sure the environment is built.
      cy.visit("/environments");
      cy.findAllByTestId(TEST_ID.ENVIRONMENTS_ROW).click();
      cy.findAllByTestId(TEST_ID.ENVIRONMENTS_TAB_BUILD).click();
      cy.findByTestId(TEST_ID.ENVIRONMENTS_BUILD_STATUS)
        .scrollIntoView()
        .should("be.visible")
        .contains("SUCCESS", { timeout: 20000 });
    });
    context("has created a job draft", () => {
      beforeEach(() => {
        cy.visit("/jobs");
        cy.findByTestId(TEST_ID.JOB_CREATE).click();
        cy.findByTestId(TEST_ID.JOB_CREATE_NAME).type(JOB_NAMES.J1);
        cy.findByTestId(TEST_ID.JOB_CREATE_OK).click();
      });

      it("creates a job that runs now", () => {
        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${JOB_NAMES.J1}`).click();
        waitForJobStatus(JOB_STATUS.SUCCESS);
        // Make sure the file was created, thus the step has properly run.
        cy.readFile(PROJECTS.DUMP_ENV_PARAMS.default_output_file);
      });

      it("creates a job thats scheduled in the past ", () => {
        cy.findByTestId(TEST_ID.JOB_EDIT_SCHEDULE_DATE).click();
        let dateTime = new Date();
        dateTime.setDate(dateTime.getDate() - 1);
        let dateString = dateTimeToInputString(dateTime);

        cy.findByTestId(TEST_ID.JOB_EDIT_SCHEDULE_DATE_INPUT_DATE).type(
          dateString
        );
        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${JOB_NAMES.J1}`).click();
        waitForJobStatus(JOB_STATUS.SUCCESS);
        // Make sure the file was created, thus the step has properly run.
        cy.readFile(PROJECTS.DUMP_ENV_PARAMS.default_output_file);
      });

      it("creates a job thats scheduled in the future ", () => {
        cy.findByTestId(TEST_ID.JOB_EDIT_SCHEDULE_DATE).click();
        let dateTime = new Date();
        dateTime.setDate(dateTime.getDate() + 1);
        let dateString = dateTimeToInputString(dateTime);

        cy.findByTestId(TEST_ID.JOB_EDIT_SCHEDULE_DATE_INPUT_DATE).type(
          dateString
        );
        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${JOB_NAMES.J1}`).click();
        waitForJobStatus(JOB_STATUS.PENDING);
      });

      it("creates a cron job", () => {
        cy.findByTestId(TEST_ID.JOB_EDIT_SCHEDULE_CRONJOB).click();
        cy.findByTestId(TEST_ID.JOB_EDIT_SCHEDULE_CRONJOB_INPUT).type(
          "{selectall}{backspace}"
        );
        cy.findByTestId(TEST_ID.JOB_EDIT_SCHEDULE_CRONJOB_INPUT).type(
          "* * * * *"
        );
        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${JOB_NAMES.J1}`).click();
        waitForJobStatus(JOB_STATUS.STARTED);
      });

      it("creates a job with parameters to trigger multiple runs", () => {
        cy.findByTestId(TEST_ID.JOB_EDIT_TAB_PARAMETERS).click();

        let dumpFiles = [1, 2, 3, 4].map((x) => `jobRun${x}.json`);
        setParameter("test-output-file", dumpFiles);
        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${JOB_NAMES.J1}`).click();
        cy.findAllByTestId(TEST_ID.JOB_PIPELINE_RUNS_ROW).should(
          "have.length",
          dumpFiles.length
        );
        waitForJobStatus(JOB_STATUS.SUCCESS);

        dumpFiles.map((x) => cy.readFile(`${DATA_DIR}/${x}`));
      });

      it("creates a job with parameters, tests combinatorial runs", () => {
        cy.findByTestId(TEST_ID.JOB_EDIT_TAB_PARAMETERS).click();

        let stepPar = [1, 2, 3, 4];
        let pipePar = ["hello", "there"];
        setParameter("pipeline-param-A", pipePar);
        setParameter("step-param-a", stepPar);
        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${JOB_NAMES.J1}`).click();

        let expectedRunsParams = [];
        for (let p = 0; p < pipePar.length; p++) {
          for (let s = 0; s < stepPar.length; s++) {
            let stepParams = {};
            stepParams["step-param-a"] = stepPar[s];
            stepParams["test-output-file"] = "test-output.json";

            let pipelineParams = {};
            pipelineParams["pipeline-param-A"] = pipePar[p];

            expectedRunsParams.push({
              stepParams: stepParams,
              pipelineParams: pipelineParams,
            });
          }
        }
        waitForJobRunsStatus(
          "Success",
          stepPar.length * pipePar.length,
          50,
          () => verifyJobRunsParameters("dump-env-params", expectedRunsParams)
        );
        waitForJobStatus(JOB_STATUS.SUCCESS);
      });

      it("creates a job with parameters, selects a subset of the runs", () => {
        cy.findByTestId(TEST_ID.JOB_EDIT_TAB_PARAMETERS).click();

        let stepPar = [1, 2, 3, 4];
        let pipePar = ["hello", "there"];
        setParameter("pipeline-param-A", pipePar);
        setParameter("step-param-a", stepPar);
        let totalRuns = stepPar.length * pipePar.length;

        // Select a subset of the runs.
        cy.findByTestId(
          `${TEST_ID.JOB_EDIT_TAB_PIPELINE_RUNS}--${totalRuns}-${totalRuns}-`
        ).click();
        for (let i = 4; i < 8; i++) {
          cy.get(`[data-test-index=${TEST_ID.JOB_EDIT_PIPELINE_RUNS_ROW}-${i}]`)
            .scrollIntoView()
            .find("input")
            .uncheck();
        }

        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${JOB_NAMES.J1}`).click();

        // Remove the last element since we have unselected the last 4
        // runs.
        pipePar.pop();
        let expectedRunsParams = [];
        for (let p = 0; p < pipePar.length; p++) {
          for (let s = 0; s < stepPar.length; s++) {
            let stepParams = {};
            stepParams["step-param-a"] = stepPar[s];
            stepParams["test-output-file"] = "test-output.json";

            let pipelineParams = {};
            pipelineParams["pipeline-param-A"] = pipePar[p];

            expectedRunsParams.push({
              stepParams: stepParams,
              pipelineParams: pipelineParams,
            });
          }
        }
        waitForJobRunsStatus(
          "Success",
          stepPar.length * pipePar.length,
          50,
          () => verifyJobRunsParameters("dump-env-params", expectedRunsParams)
        );
        waitForJobStatus(JOB_STATUS.SUCCESS);
      });
    });

    [
      {
        project_env_vars_names: ["a", "b", "c", "e"],
        project_env_vars_values: ["1", "2", "3", "ePrVal"],
        pipelines_env_vars_names: ["b", "c", "d"],
        pipelines_env_vars_values: ["2", "override", "4"],
        job_env_vars_names: ["c", "d", "e", "f"],
        job_env_vars_values: ["cJVal", "dJVal", "eJVal", "fJVal"],
      },
    ].forEach((envVars) => {
      assert(
        envVars.project_env_vars_names.length ==
          envVars.project_env_vars_values.length
      );
      assert(
        envVars.pipelines_env_vars_names.length ==
          envVars.pipelines_env_vars_values.length
      );
      assert(
        envVars.job_env_vars_names.length == envVars.job_env_vars_values.length
      );
      it("creates a job with project, pipeline, job env vars", () => {
        cy.addProjectEnvVars(
          PROJECTS.DUMP_ENV_PARAMS.name,
          envVars.project_env_vars_names,
          envVars.project_env_vars_values
        );
        cy.addPipelineEnvVars(
          PROJECTS.DUMP_ENV_PARAMS.pipelines[0],
          envVars.pipelines_env_vars_names,
          envVars.pipelines_env_vars_values
        );

        cy.visit("/jobs");
        cy.findByTestId(TEST_ID.JOB_CREATE).click();
        cy.findByTestId(TEST_ID.JOB_CREATE_NAME).type(JOB_NAMES.J1);
        cy.findByTestId(TEST_ID.JOB_CREATE_OK).click();

        // Set job env vars.
        cy.findByTestId(TEST_ID.JOB_EDIT_TAB_ENVIRONMENT_VARIABLES).click();
        for (let i = 0; i < envVars.job_env_vars_names.length; i++) {
          let envVarName = envVars.job_env_vars_names[i];
          let envVarValue = envVars.job_env_vars_values[i];
          // Modify the existing value.
          if (
            envVars.project_env_vars_names.indexOf(envVarName) !== -1 ||
            envVars.pipelines_env_vars_names.indexOf(envVarName) !== -1
          ) {
            cy.get(`[data-test-title=job-edit-env-var-${envVarName}-value]`)
              .scrollIntoView()
              .type("{selectall}{backspace}")
              .type(envVarValue);
          }
          // Create a new env var.
          else {
            cy.findByTestId(TEST_ID.JOB_EDIT_ENV_VAR_ADD)
              .scrollIntoView()
              .click();
            // Would not support concurrent adds.
            cy.findAllByTestId(TEST_ID.JOB_EDIT_ENV_VAR_NAME)
              .last()
              .scrollIntoView()
              .type(envVars.job_env_vars_names[i]);
            cy.findAllByTestId(TEST_ID.JOB_EDIT_ENV_VAR_VALUE)
              .last()
              .type(envVars.job_env_vars_values[i]);
          }
        }

        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${JOB_NAMES.J1}`).click();
        waitForJobStatus(JOB_STATUS.SUCCESS);

        let expectedEnv = {};
        for (let i = 0; i < envVars.project_env_vars_names.length; i++) {
          expectedEnv[envVars.project_env_vars_names[i]] =
            envVars.project_env_vars_values[i];
        }
        for (let i = 0; i < envVars.pipelines_env_vars_names.length; i++) {
          expectedEnv[envVars.pipelines_env_vars_names[i]] =
            envVars.pipelines_env_vars_values[i];
        }
        for (let i = 0; i < envVars.job_env_vars_names.length; i++) {
          expectedEnv[envVars.job_env_vars_names[i]] =
            envVars.job_env_vars_values[i];
        }

        cy.readFile(PROJECTS.DUMP_ENV_PARAMS.default_output_file)
          .its("env")
          .then((env) => {
            Object.keys(expectedEnv).forEach((key) => {
              assert(env[key] == expectedEnv[key]);
            });
          });
      });
    });
  });
  context("requires the data-passing pipeline ", () => {
    beforeEach(() => {
      // Copy the pipeline.
      cy.exec(`cp -r ${PROJECTS.DATA_PASSING.get_path()} userdir/projects/`);
      // To trigger the project discovery.
      cy.visit("/projects");
      cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should("have.length", 1);
      // Make sure the environment is built.
      cy.visit("/environments");
      cy.findAllByTestId(TEST_ID.ENVIRONMENTS_ROW).click();
      cy.findAllByTestId(TEST_ID.ENVIRONMENTS_TAB_BUILD).click();
      cy.findByTestId(TEST_ID.ENVIRONMENTS_BUILD_STATUS)
        .scrollIntoView()
        .should("be.visible")
        .contains("SUCCESS", { timeout: 20000 });
    });

    context("has created a job draft", () => {
      beforeEach(() => {
        cy.visit("/jobs");
        cy.findByTestId(TEST_ID.JOB_CREATE).click();
        cy.findByTestId(TEST_ID.JOB_CREATE_NAME).type(JOB_NAMES.J1);
        cy.findByTestId(TEST_ID.JOB_CREATE_OK).click();
      });

      [
        {
          input_data: {
            a: 1,
            b: ["2", "3"],
            c: { d: { e: "hello" } },
          },
        },
        {
          input_data: {
            a: 1,
            b: ["2", "3"],
            c: { d: { e: "hello" } },
          },
          input_data_name: "output_name",
        },
      ].forEach((paramsA) => {
        it(`tests data passing - ${
          paramsA.input_data_name === undefined ? "unnamed" : "named"
        }`, () => {
          cy.findByTestId(TEST_ID.JOB_EDIT_TAB_PARAMETERS).click();

          setParameter("input_data", [paramsA.input_data]);
          if (paramsA.input_data_name !== undefined) {
            setParameter("input_data_name", [paramsA.input_data_name]);
          }
          cy.findByTestId(TEST_ID.JOB_RUN).click();
          cy.findByTestId(`job-${JOB_NAMES.J1}`).click();
          waitForJobStatus(JOB_STATUS.SUCCESS);

          let expectedName =
            paramsA.input_data_name === undefined
              ? "unnamed"
              : paramsA.input_data_name;
          let expectedValue =
            paramsA.input_data_name === undefined
              ? [paramsA.input_data]
              : paramsA.input_data;

          cy.readFile(PROJECTS.DATA_PASSING.default_output_file)
            .its(expectedName)
            .should("deep.equal", expectedValue);
        });
      });
    });
  });
});
