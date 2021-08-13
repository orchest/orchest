import {
  TEST_ID,
  PROJECTS,
  DATA_DIR,
  PROJECTS_DIR,
  getJobProjectDirPath,
  SAMPLE_JOB_NAMES,
  SAMPLE_PROJECT_NAMES,
  JOB_STATUS,
  waitForJobStatus,
  mergeEnvVariables,
} from "../support/common";

function verifyExternalConnectivity(externalConnData: { string: [string] }) {
  for (const [service, urls] of Object.entries(externalConnData)) {
    urls.forEach((url) => {
      url = url.replace("http://{host_name}:{port}", "");
      cy.log(`Verifying external connectivity for ${service} at ${url}.`);
      cy.request(url);
    });
  }
}

describe("services", () => {
  beforeEach(() => {
    cy.setOnboardingCompleted("true");
  });

  context("requires the services-connectivity project ", () => {
    beforeEach(() => {
      // Copy the pipeline.
      cy.exec(
        `cp -r ${PROJECTS.SERVICES_CONNECTIVITY.get_path()} userdir/projects/`
      );
      // To trigger the project discovery.
      cy.goToMenu("projects");
      cy.findAllByTestId(TEST_ID.PROJECTS_TABLE_ROW).should("have.length", 1);
      // Make sure the environment is built.
      cy.goToMenu("environments");
      cy.findAllByTestId(TEST_ID.ENVIRONMENTS_ROW).click();
      cy.findAllByTestId(TEST_ID.ENVIRONMENTS_TAB_BUILD).click();
      cy.findByTestId(TEST_ID.ENVIRONMENTS_BUILD_STATUS)
        .scrollIntoView()
        .should("be.visible")
        .contains("SUCCESS", { timeout: 20000 });
    });

    context("requires a running interactive session", () => {
      beforeEach(() => {
        cy.goToMenu("pipelines");
        cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
        cy.findAllByTestId(
          TEST_ID.SESSION_TOGGLE_BUTTON
        ).contains("Stop session", { timeout: 30000 });
      });
      it("tests for services connectivity in interactive runs", () => {
        cy.get(
          `[data-test-title=${PROJECTS.SERVICES_CONNECTIVITY.name}]`
        ).click({ force: true });
        cy.findByTestId(TEST_ID.INTERACTIVE_RUN_RUN_SELECTED_STEPS).click();
        cy.get(`[data-test-title=${PROJECTS.SERVICES_CONNECTIVITY.name}]`)
          .scrollIntoView()
          .contains("Completed", { timeout: 20000 });

        // Check that the internal connectivity check has gone well.
        cy.readFile(PROJECTS.SERVICES_CONNECTIVITY.default_output_file)
          .its("internal-connectivity")
          .should("deep.equal", {
            "redis-services": {
              redis: true,
            },
            "postgres-services": {
              postgres: true,
            },
          });

        // Verify external connectivity.
        cy.readFile(PROJECTS.SERVICES_CONNECTIVITY.default_output_file)
          .its("external-connectivity")
          .then(verifyExternalConnectivity);
      });
    });

    context("has created a job draft", () => {
      beforeEach(() => {
        cy.goToMenu("jobs");
        cy.findByTestId(TEST_ID.JOB_CREATE).click();
        cy.findByTestId(TEST_ID.JOB_CREATE_NAME).type(SAMPLE_JOB_NAMES.J1);
        cy.findByTestId(TEST_ID.JOB_CREATE_OK).click();
      });

      it("tests for services connectivity in jobs", () => {
        cy.findByTestId(TEST_ID.JOB_RUN).click();
        cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();
        waitForJobStatus(JOB_STATUS.SUCCESS);

        // Check that the internal connectivity check has gone well.
        cy.readFile(PROJECTS.SERVICES_CONNECTIVITY.default_output_file)
          .its("internal-connectivity")
          .should("deep.equal", {
            "redis-services": {
              redis: true,
            },
            "postgres-services": {
              postgres: true,
            },
          });
      });
    });
  });
  it("tests services data mounting for interactive runs", () => {
    cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    cy.createPipeline(SAMPLE_PROJECT_NAMES.P1);
    cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
    cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains("Stop session", {
      timeout: 30000,
    });
    cy.findByTestId(TEST_ID.PIPELINE_SETTINGS).click();
    cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_TAB_SERVICES).click();
    cy.findByTestId(TEST_ID.PIPELINE_SERVICE_ADD).click();
    cy.findByTestId("pipeline-service-template-empty").click();
    cy.findByTestId(TEST_ID.PIPELINE_SERVICES_ROW).click();
    let name = "my-service";
    cy.findByTestId(`service-${name}-entrypoint`).type(
      "touch /my-mounted-data/test1.txt /my-mounted-project/test2.txt"
    );
    cy.findByTestId(`service-${name}-project-mount`).type(
      "/my-mounted-project"
    );
    cy.findByTestId(`service-${name}-data-mount`).type("/my-mounted-data");
    cy.findByTestId(`service-${name}-image`).click();
    cy.findByTestId(TEST_ID.SERVICE_IMAGE_NAME_DIALOG_IMAGE_NAME).type("redis");
    cy.findByTestId(TEST_ID.SERVICE_IMAGE_NAME_DIALOG_SAVE).click();
    cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_SAVE).click();

    // Restart the session.
    cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).click();
    cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains(
      "Start session",
      { timeout: 30000 }
    );
    cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).click();
    cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains("Stop session", {
      timeout: 30000,
    });

    // Verify that the service was able to touch the files through the
    // data and project directory mounts.
    cy.readFile(`${DATA_DIR}/test1.txt`);
    cy.readFile(`${PROJECTS_DIR}/${SAMPLE_PROJECT_NAMES.P1}/test2.txt`);
  });

  it("tests services data mounting for jobs", () => {
    cy.createProject(SAMPLE_PROJECT_NAMES.P1);
    cy.createPipeline(SAMPLE_PROJECT_NAMES.P1);
    cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();

    cy.findByTestId(TEST_ID.PIPELINE_SETTINGS).click();
    cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_TAB_SERVICES).click();
    cy.findByTestId(TEST_ID.PIPELINE_SERVICE_ADD).click();
    cy.findByTestId("pipeline-service-template-empty").click();
    cy.findByTestId(TEST_ID.PIPELINE_SERVICES_ROW).click();
    let name = "my-service";
    cy.findByTestId(`service-${name}-entrypoint`).type(
      "touch /my-mounted-data/test1.txt /my-mounted-project/test2.txt"
    );
    cy.findByTestId(`service-${name}-project-mount`).type(
      "/my-mounted-project"
    );
    cy.findByTestId(`service-${name}-data-mount`).type("/my-mounted-data");
    cy.findByTestId(`service-${name}-image`).click();
    cy.findByTestId(TEST_ID.SERVICE_IMAGE_NAME_DIALOG_IMAGE_NAME).type("redis");
    cy.findByTestId(TEST_ID.SERVICE_IMAGE_NAME_DIALOG_SAVE).click();
    cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_SAVE).click();

    // Create and run the job.
    cy.goToMenu("jobs");
    cy.findByTestId(TEST_ID.JOB_CREATE).click();
    cy.findByTestId(TEST_ID.JOB_CREATE_NAME).type(SAMPLE_JOB_NAMES.J1);
    cy.findByTestId(TEST_ID.JOB_CREATE_OK).click();
    cy.findByTestId(TEST_ID.JOB_RUN).click();
    cy.findByTestId(`job-${SAMPLE_JOB_NAMES.J1}`).click();
    waitForJobStatus(JOB_STATUS.SUCCESS);
    cy.intercept("GET", "/catch/api-proxy/api/jobs/*").as("jobData");
    cy.reload();

    // Verify that the service was able to touch the files through the
    // data and project directory mounts.
    cy.readFile(`${DATA_DIR}/test1.txt`);
    cy.wait("@jobData")
      .its("response.body")
      .then((data) => {
        let dirPath = getJobProjectDirPath(
          data.project_uuid,
          data.pipeline_uuid,
          // uuid of the job.
          data.uuid,
          data.pipeline_runs[0].uuid
        );
        cy.readFile(`${dirPath}/test2.txt`);
      });
  });

  [
    {
      // Here the service inherits a,b from the project, pipeline
      // respectively. c is a variable it owns.
      project_env_vars_names: ["a"],
      project_env_vars_values: ["aPrVal"],
      pipelines_env_vars_names: ["b"],
      pipelines_env_vars_values: ["bPlVal"],
      service_env_vars_names: ["c"],
      service_env_vars_values: ["cSvVal"],
      service_inherited_env_vars: ["a", "b"],
    },
    {
      // Like before, but c should be overridden by the pipeline env
      // var.
      project_env_vars_names: ["a"],
      project_env_vars_values: ["aPrVal"],
      pipelines_env_vars_names: ["b", "c"],
      pipelines_env_vars_values: ["bPlVal", "cPlVal"],
      service_env_vars_names: ["c"],
      service_env_vars_values: ["cSvVal"],
      service_inherited_env_vars: ["a", "b", "c"],
    },
  ].forEach((envVars) => {
    [
      [envVars.project_env_vars_names, envVars.project_env_vars_names],
      [envVars.pipelines_env_vars_names, envVars.pipelines_env_vars_values],
      [envVars.service_env_vars_names, envVars.service_env_vars_values],
    ].forEach((x) => assert(x[0].length == x[1].length));

    it("tests services env vars for interactive runs", () => {
      // Create the project and pipeline and add env variables.
      cy.createProject(SAMPLE_PROJECT_NAMES.P1);
      cy.addProjectEnvVars(
        SAMPLE_PROJECT_NAMES.P1,
        envVars.project_env_vars_names,
        envVars.project_env_vars_values
      );
      cy.createPipeline(SAMPLE_PROJECT_NAMES.P1);
      cy.addPipelineEnvVars(
        SAMPLE_PROJECT_NAMES.P1,
        envVars.pipelines_env_vars_names,
        envVars.pipelines_env_vars_values
      );
      cy.goToMenu("pipelines");

      // Create and configure the service.
      cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
      cy.findByTestId(TEST_ID.PIPELINE_SETTINGS).click();
      cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_TAB_SERVICES).click();
      cy.findByTestId(TEST_ID.PIPELINE_SERVICE_ADD).click();
      cy.findByTestId("pipeline-service-template-empty").click();
      cy.findByTestId(TEST_ID.PIPELINE_SERVICES_ROW).click();

      // Define what the run environment variables should be and what
      // the service env vars will be based on inheritance.
      let expectedRunEnv = mergeEnvVariables([
        [envVars.project_env_vars_names, envVars.project_env_vars_values],
        [envVars.pipelines_env_vars_names, envVars.pipelines_env_vars_values],
      ]);

      let expectedServiceEnv = {};
      for (let i = 0; i < envVars.service_env_vars_names.length; i++) {
        expectedServiceEnv[envVars.service_env_vars_names[i]] =
          envVars.service_env_vars_values[i];
      }
      for (let i = 0; i < envVars.service_inherited_env_vars.length; i++) {
        expectedServiceEnv[envVars.service_inherited_env_vars[i]] =
          expectedRunEnv[envVars.service_inherited_env_vars[i]];
      }

      // We will dump the variable to a test file.
      let variablesToDump = [];
      let expectedValues = []; // We will use this later.
      for (const [k, v] of Object.entries(expectedServiceEnv)) {
        variablesToDump.push(k);
        expectedValues.push(v);
      }
      let envVarsToDump = variablesToDump.map((x) => `\${${x}}`);
      let dumpExpression = envVarsToDump.join(",");

      let name = "my-service";
      cy.findByTestId(`service-${name}-entrypoint`).type(
        `sh -c "echo ${dumpExpression} > /data/test.txt"`
      );
      cy.findByTestId(`service-${name}-data-mount`).type("/data");
      cy.findByTestId(`service-${name}-image`).click();
      cy.findByTestId(TEST_ID.SERVICE_IMAGE_NAME_DIALOG_IMAGE_NAME).type(
        "redis"
      );
      cy.findByTestId(TEST_ID.SERVICE_IMAGE_NAME_DIALOG_SAVE).click();

      for (let i = 0; i < envVars.service_env_vars_names.length; i++) {
        cy.findByTestId(`service-${name}-env-var-add`).scrollIntoView().click();
        cy.findByTestId(`service-${name}-env-var-name`)
          .last()
          .type(envVars.service_env_vars_names[i]);
        cy.findByTestId(`service-${name}-env-var-value`)
          .last()
          .type(envVars.service_env_vars_values[i]);
      }
      cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_SAVE).click();

      for (let i = 0; i < envVars.service_inherited_env_vars.length; i++) {
        cy.findByTestId(`service-${name}-inherited-env-vars`)
          .scrollIntoView()
          .type(envVars.service_inherited_env_vars[i]);
        // Typing {enter} won't work to define an env var, need to save.
        cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_SAVE).click();
      }

      // Restart the session.
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).click();
      cy.findAllByTestId(
        TEST_ID.SESSION_TOGGLE_BUTTON
      ).contains("Start session", { timeout: 30000 });
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).click();
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains(
        "Stop session",
        { timeout: 30000 }
      );

      let expectedFileContent = expectedValues.map(String).join(",") + "\n";
      console.log(dumpExpression);
      console.log(expectedFileContent);
      cy.readFile(`${DATA_DIR}/test.txt`).should("eq", expectedFileContent);
    });
  });

  [
    {
      // Here the service inherits a,b,c from the project, pipeline and
      // job respectively. d is a variable it owns.
      project_env_vars_names: ["a"],
      project_env_vars_values: ["aPrVal"],
      pipelines_env_vars_names: ["b"],
      pipelines_env_vars_values: ["bPlVal"],
      job_env_vars_names: ["c"],
      job_env_vars_values: ["cJVal"],
      service_env_vars_names: ["d"],
      service_env_vars_values: ["dSvVal"],
      service_inherited_env_vars: ["a", "b", "c"],
    },
    {
      // Like before, but d should be overridden by the job env var.
      project_env_vars_names: ["a"],
      project_env_vars_values: ["aPrVal"],
      pipelines_env_vars_names: ["b"],
      pipelines_env_vars_values: ["bPlVal"],
      job_env_vars_names: ["c", "d"],
      job_env_vars_values: ["cJVal", "dJVal"],
      service_env_vars_names: ["d"],
      service_env_vars_values: ["dSvVal"],
      service_inherited_env_vars: ["a", "b", "c", "d"],
    },
  ].forEach((envVars) => {
    [
      [envVars.project_env_vars_names, envVars.project_env_vars_names],
      [envVars.pipelines_env_vars_names, envVars.pipelines_env_vars_values],
      [envVars.job_env_vars_names, envVars.job_env_vars_values],
      [envVars.service_env_vars_names, envVars.service_env_vars_values],
    ].forEach((x) => assert(x[0].length == x[1].length));

    it("tests services env vars for jobs", () => {
      // Create the project and pipeline and add env variables.
      cy.createProject(SAMPLE_PROJECT_NAMES.P1);
      cy.addProjectEnvVars(
        SAMPLE_PROJECT_NAMES.P1,
        envVars.project_env_vars_names,
        envVars.project_env_vars_values
      );
      cy.createPipeline(SAMPLE_PROJECT_NAMES.P1);
      cy.addPipelineEnvVars(
        SAMPLE_PROJECT_NAMES.P1,
        envVars.pipelines_env_vars_names,
        envVars.pipelines_env_vars_values
      );
      cy.goToMenu("pipelines");

      // Create and configure the service.
      cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
      cy.findByTestId(TEST_ID.PIPELINE_SETTINGS).click();
      cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_TAB_SERVICES).click();
      cy.findByTestId(TEST_ID.PIPELINE_SERVICE_ADD).click();
      cy.findByTestId("pipeline-service-template-empty").click();
      cy.findByTestId(TEST_ID.PIPELINE_SERVICES_ROW).click();

      // Define what the job environment variables should be and what
      // the service env vars will be based on inheritance.
      let expectedJobEnv = mergeEnvVariables([
        [envVars.project_env_vars_names, envVars.project_env_vars_values],
        [envVars.pipelines_env_vars_names, envVars.pipelines_env_vars_values],
        [envVars.job_env_vars_names, envVars.job_env_vars_values],
      ]);

      let expectedServiceEnv = {};
      for (let i = 0; i < envVars.service_env_vars_names.length; i++) {
        expectedServiceEnv[envVars.service_env_vars_names[i]] =
          envVars.service_env_vars_values[i];
      }
      for (let i = 0; i < envVars.service_inherited_env_vars.length; i++) {
        expectedServiceEnv[envVars.service_inherited_env_vars[i]] =
          expectedJobEnv[envVars.service_inherited_env_vars[i]];
      }

      // We will dump the variable to a test file.
      let variablesToDump = [];
      let expectedValues = []; // We will use this later.
      for (const [k, v] of Object.entries(expectedServiceEnv)) {
        variablesToDump.push(k);
        expectedValues.push(v);
      }
      let envVarsToDump = variablesToDump.map((x) => `\${${x}}`);
      let dumpExpression = envVarsToDump.join(",");

      let name = "my-service";
      cy.findByTestId(`service-${name}-entrypoint`).type(
        `sh -c "echo ${dumpExpression} > /data/test.txt"`
      );
      cy.findByTestId(`service-${name}-data-mount`).type("/data");
      cy.findByTestId(`service-${name}-image`).click();
      cy.findByTestId(TEST_ID.SERVICE_IMAGE_NAME_DIALOG_IMAGE_NAME).type(
        "redis"
      );
      cy.findByTestId(TEST_ID.SERVICE_IMAGE_NAME_DIALOG_SAVE).click();

      for (let i = 0; i < envVars.service_env_vars_names.length; i++) {
        cy.findByTestId(`service-${name}-env-var-add`).scrollIntoView().click();
        cy.findByTestId(`service-${name}-env-var-name`)
          .last()
          .type(envVars.service_env_vars_names[i]);
        cy.findByTestId(`service-${name}-env-var-value`)
          .last()
          .type(envVars.service_env_vars_values[i]);
      }
      cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_SAVE).click();

      for (let i = 0; i < envVars.service_inherited_env_vars.length; i++) {
        cy.findByTestId(`service-${name}-inherited-env-vars`)
          .scrollIntoView()
          .type(envVars.service_inherited_env_vars[i]);
        // Typing {enter} won't work to define an env var, need to save.
        cy.findByTestId(TEST_ID.PIPELINE_SETTINGS_SAVE).click();
      }

      // Create and run the job.
      cy.goToMenu("jobs");
      cy.findByTestId(TEST_ID.JOB_CREATE).click();
      cy.findByTestId(TEST_ID.JOB_CREATE_NAME).type(SAMPLE_JOB_NAMES.J1);
      cy.findByTestId(TEST_ID.JOB_CREATE_OK).click();
      // Set env vars.
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

      let expectedFileContent = expectedValues.map(String).join(",") + "\n";
      console.log(dumpExpression);
      console.log(expectedFileContent);
      cy.readFile(`${DATA_DIR}/test.txt`).should("eq", expectedFileContent);
    });
  });
});
