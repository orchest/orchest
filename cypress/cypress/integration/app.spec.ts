import { reset, TEST_ID } from "../support/common";

const ORCHEST_EXECUTABLE_PATH = "../orchest";

describe("app", () => {
  beforeEach(() => {
    reset();
    cy.visit("/");
  });

  it("renders", () => {
    cy.findByTestId("root")
      .should("exist")
      .and("be.visible")
      .within(() => {
        cy.findByTestId("app").should("exist").and("be.visible");
      });
  });

  it("restarts", () => {
    cy.setOnboardingCompleted("true");
    cy.disableCheckUpdate();
    cy.visit("settings");
    cy.findAllByTestId(TEST_ID.RESTART).scrollIntoView().click();
    cy.findAllByTestId(TEST_ID.CONFIRM_DIALOG_OK).click();
    // NOTE: can't use --ext because dev mode currently breaks health
    // for the web and auth server due to requests being proxied.
    let status_check = `for i in $(seq 1 10);  do ${ORCHEST_EXECUTABLE_PATH} status --ext;
      s=$? && ( test $s -eq 0 ) && break ||
      timeout 5s tail -f /dev/null; done; exit $s`;
    // Will fail the test if the exit code is != 0.
    cy.exec(status_check);
    cy.reload(true);
    cy.findByTestId(TEST_ID.ORCHEST_LOGO).should("be.visible");
  });
});
