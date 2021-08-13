import * as deepEqual from "deep-equal";
import {
  assertEnvIsBuilt,
  mergeEnvVariables,
  setJobParameter,
  waitForJobStatus,
  waitForJobRunsStatus,
  dateTimeToInputString,
  TEST_ID,
  PROJECTS,
  DATA_DIR,
  SAMPLE_JOB_NAMES,
  JOB_STATUS,
} from "../support/common";

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
            cy.triggerESC();

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
      cy.goToMenu("projects");
      cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should("have.length", 1);
      assertEnvIsBuilt();
    });
    context("has created a job draft", () => {
      beforeEach(() => {
        cy.goToMenu("jobs");
        cy.findByTestId(TEST_ID.JOB_CREATE).click();
        cy.findByTestId(TEST_ID.JOB_CREATE_NAME).type(SAMPLE_JOB_NAMES.J1);
        cy.findByTestId(TEST_ID.JOB_CREATE_OK).click();
      });

      it("creates a job that runs now", () => {
        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();
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
        cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();
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
        cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();
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
        cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();
        waitForJobStatus(JOB_STATUS.STARTED);
      });

      it("creates a job with parameters to trigger multiple runs", () => {
        let dumpFiles = [1, 2, 3, 4].map((x) => `jobRun${x}.json`);
        setJobParameter("test-output-file", dumpFiles);
        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();
        cy.findAllByTestId(TEST_ID.JOB_PIPELINE_RUNS_ROW).should(
          "have.length",
          dumpFiles.length
        );
        waitForJobStatus(JOB_STATUS.SUCCESS);

        dumpFiles.map((x) => cy.readFile(`${DATA_DIR}/${x}`));
      });

      it.only("creates a job with parameters, tests combinatorial runs", () => {
        let stepPar = [1, 2, 3, 4];
        let pipePar = ["hello", "there"];
        setJobParameter("pipeline-param-A", pipePar);
        setJobParameter("step-param-a", stepPar);
        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();

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
        let stepPar = [1, 2, 3, 4];
        let pipePar = ["hello", "there"];
        setJobParameter("pipeline-param-A", pipePar);
        setJobParameter("step-param-a", stepPar);
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
        cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();

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
      [
        [envVars.project_env_vars_names, envVars.project_env_vars_names],
        [envVars.pipelines_env_vars_names, envVars.pipelines_env_vars_values],
        [envVars.job_env_vars_names, envVars.job_env_vars_values],
      ].forEach((x) => assert(x[0].length == x[1].length));
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

        cy.goToMenu("jobs");
        cy.findByTestId(TEST_ID.JOB_CREATE).click();
        cy.findByTestId(TEST_ID.JOB_CREATE_NAME).type(SAMPLE_JOB_NAMES.J1);
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
        cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();
        waitForJobStatus(JOB_STATUS.SUCCESS);

        let expectedEnv = mergeEnvVariables([
          [envVars.project_env_vars_names, envVars.project_env_vars_values],
          [envVars.pipelines_env_vars_names, envVars.pipelines_env_vars_values],
          [envVars.job_env_vars_names, envVars.job_env_vars_values],
        ]);

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
      cy.goToMenu("projects");
      cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should("have.length", 1);
      assertEnvIsBuilt();
    });

    context("has created a job draft", () => {
      beforeEach(() => {
        cy.goToMenu("jobs");
        cy.findByTestId(TEST_ID.JOB_CREATE).click();
        cy.findByTestId(TEST_ID.JOB_CREATE_NAME).type(SAMPLE_JOB_NAMES.J1);
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
          setJobParameter("input_data", [paramsA.input_data]);
          if (paramsA.input_data_name !== undefined) {
            setJobParameter("input_data_name", [paramsA.input_data_name]);
          }
          cy.findByTestId(TEST_ID.JOB_RUN).click();
          cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();
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
