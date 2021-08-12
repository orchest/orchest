import { TEST_ID, PROJECTS_DIR } from "../support/common";

enum PROJECT_NAMES {
  P1 = "test-project-1",
  P2 = "test-project-2",
}

enum PIPELINE_NAMES {
  PL1 = "test-pipeline-1",
  PL2 = "test-pipeline-2",
}

enum STEP_NAMES {
  ST1 = "test-step-1",
  ST2 = "test-step-2",
}

let pathTestCases = [
  ["/a", "a"],
  ["./a", "a"],
  ["/b/c/../a", "b/a"],
  // More than one initial slash is actually a special case:
  // https://stackoverflow.com/questions/52260324/why-os-path-normpath-does-not-remove-the-firsts
  ["//b/c/../a", "b/a"],
  ["///b/c/../a", "b/a"],
  ["b/c/../a", "b/a"],
  ["b/././a", "b/a"],
];

function waitForJupyterlab() {
  cy.getIframe(TEST_ID.JUPYTERLAB_IFRAME)
    .contains("Kernel", { timeout: 20000 })
    .should("be.visible");
}

describe("pipelines", () => {
  beforeEach(() => {
    cy.setOnboardingCompleted("true");
    cy.createProject(PROJECT_NAMES.P1);
    cy.visit("/pipelines");
  });

  afterEach(() => {
    // cy.deleteAllPipelines()
    // cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).should("have.length", 0);
  });

  it("creates a pipeline", () => {
    cy.createPipeline(PIPELINE_NAMES.PL1);
    let expectedFile = `${PIPELINE_NAMES.PL1.replaceAll("-", "_")}.orchest`;
    cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${expectedFile}`);
  });

  it("creates a pipeline, modifies the path", () => {
    let path = `my-super-test.orchest`;
    cy.createPipeline(PIPELINE_NAMES.PL1, path);
    cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${path}`);
  });

  it("creates a pipeline, modifies the path to be a directory that does not exist", () => {
    let path = `a/b/c/my-super-test.orchest`;
    cy.createPipeline(PIPELINE_NAMES.PL1, path);
    cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${path}`);
  });

  it("creates a pipeline, copies the file", () => {
    cy.createPipeline(PIPELINE_NAMES.PL1);
    let expectedFile = `${PIPELINE_NAMES.PL1.replaceAll("-", "_")}.orchest`;
    // Make a copy of the file, expect Orchest to pick it up as a new
    // pipeline.
    let originalPath = `${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${expectedFile}`;
    let copyPath = `${PROJECTS_DIR}/${PROJECT_NAMES.P1}/copy.orchest`;
    cy.exec(`cp ${originalPath} ${copyPath}`);
    cy.visit("/pipelines");
    cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).should("have.length", 2);
  });

  it("deletes a pipeline through the fs", () => {
    cy.createPipeline(PIPELINE_NAMES.PL1);
    let expectedFile = `${PIPELINE_NAMES.PL1.replaceAll("-", "_")}.orchest`;
    let expectedPath = `${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${expectedFile}`;
    // Make sure the creation went well.
    cy.readFile(expectedPath);
    // Remove through the FS, expect Orchest to be aware when
    // refreshing.
    cy.exec(`rm ${expectedPath}`);
    cy.visit("/pipelines");
    cy.findAllByTestId(TEST_ID.PIPELINES_TABLE_ROW).should("have.length", 0);
  });

  it("creates a pipeline, edits the path", () => {
    cy.intercept("PUT", /.*/).as("allPuts");
    cy.createPipeline(PIPELINE_NAMES.PL1);
    let path = `my-super-test.orchest`;
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH).click();
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_TEXTFIELD)
      .should("be.visible")
      .type("{selectall}{backspace}")
      .type(path);
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_SAVE).click();
    cy.wait("@allPuts");
    cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${path}`);
  });

  it("creates a pipeline, edits the path to be a directory that does not exist", () => {
    cy.intercept("PUT", /.*/).as("allPuts");
    let path = `/a/b/c/my-super-test.orchest`;
    cy.createPipeline(PIPELINE_NAMES.PL1);
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH).click();
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_TEXTFIELD)
      .should("be.visible")
      .type("{selectall}{backspace}")
      .type(path);
    cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_SAVE).click();
    cy.wait("@allPuts");
    cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${path}`);
  });

  pathTestCases.forEach((input) => {
    it(`tests pipelines create path normalization (${input[0]} to ${input[1]})`, () => {
      cy.createPipeline(PIPELINE_NAMES.PL1, input[0] + ".orchest");
      cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${input[1]}.orchest`);
    });
    it(`tests pipelines path edit normalization (${input[0]} to ${input[1]})`, () => {
      cy.intercept("PUT", /.*/).as("allPuts");
      cy.createPipeline(PIPELINE_NAMES.PL1);
      cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH).click();
      cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_TEXTFIELD)
        .should("be.visible")
        .type("{selectall}{backspace}")
        .type(input[0] + ".orchest");
      cy.findByTestId(TEST_ID.PIPELINE_EDIT_PATH_SAVE).click();
      cy.wait("@allPuts");
      cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${input[1]}.orchest`);
    });
  });

  context("requires an environment image to be available", () => {
    beforeEach(() => {
      cy.createPipeline(PIPELINE_NAMES.PL1);
      cy.visit("/environments");
      cy.findAllByTestId(TEST_ID.ENVIRONMENTS_ROW).click();
      cy.findAllByTestId(TEST_ID.ENVIRONMENTS_TAB_BUILD).click();
      cy.findByTestId(TEST_ID.ENVIRONMENTS_BUILD_STATUS)
        .scrollIntoView()
        .should("be.visible")
        .contains("SUCCESS", { timeout: 20000 });
      cy.visit("/pipelines");
    });

    it("opens the pipeline editor, ", () => {
      cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
      cy.findByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).should("be.visible");
    });

    it("stops the session and restarts it, ", () => {
      cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();

      // Expect a running session.
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains(
        "Stop session",
        { timeout: 30000 }
      );
      cy.findAllByTestId(TEST_ID.SWITCH_TO_JUPYTERLAB)
        .should("be.visible")
        .should("be.enabled");
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).click();

      // Expect a stopped session.
      cy.findAllByTestId(
        TEST_ID.SESSION_TOGGLE_BUTTON
      ).contains("Start session", { timeout: 30000 });
      cy.findAllByTestId(TEST_ID.SWITCH_TO_JUPYTERLAB)
        .should("be.visible")
        .should("be.disabled");

      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).click();
      // Expect a running session again.
      cy.findAllByTestId(TEST_ID.SESSION_TOGGLE_BUTTON).contains(
        "Stop session",
        { timeout: 30000 }
      );
      cy.findAllByTestId(TEST_ID.SWITCH_TO_JUPYTERLAB)
        .should("be.visible")
        .should("be.enabled");
    });

    it("creates a step, default file name", () => {
      cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
      cy.createStep(STEP_NAMES.ST1, true);
      cy.readFile(
        `${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${STEP_NAMES.ST1}.ipynb`
      );
    });

    it("creates a step, modifies the file name", () => {
      cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
      cy.createStep(STEP_NAMES.ST1, true, "my-test");
      let fileName = "my-test";
      cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${fileName}.ipynb`);
    });

    pathTestCases.forEach((input) => {
      it(`tests step file creation path normalization (${input[0]} to ${input[1]})`, () => {
        cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
        cy.createStep(input[0], true, input[1]);
        cy.readFile(`${PROJECTS_DIR}/${PROJECT_NAMES.P1}/${input[1]}.ipynb`);
      });
    });

    context("requires a running session", () => {
      beforeEach(() => {
        cy.findByTestId(TEST_ID.PIPELINES_TABLE_ROW).click();
        // Expect a running session.
        cy.findAllByTestId(
          TEST_ID.SESSION_TOGGLE_BUTTON
        ).contains("Stop session", { timeout: 30000 });
      });
      it("tests getting into Jupyterlab", () => {
        cy.findByTestId(TEST_ID.SWITCH_TO_JUPYTERLAB).click();
        waitForJupyterlab();
      });

      it("tests opening a step in Jupyterlab", () => {
        cy.createStep(STEP_NAMES.ST1, true);
        // Assumes unique step names.
        cy.get(`[data-test-title=${STEP_NAMES.ST1}]`)
          .scrollIntoView()
          .click({ force: true });
        cy.findByTestId(TEST_ID.STEP_VIEW_IN_JUPYTERLAB).click();
        waitForJupyterlab();
      });
    });
  });
});
