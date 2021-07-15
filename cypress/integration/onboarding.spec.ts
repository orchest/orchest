import projectsWithQuickstart from "../fixtures/async/projects/with-quickstart.json";

enum TEST_ID {
  COMPLETE_WITH_QUICKSTART = "onboarding-complete-with-quickstart",
  COMPLETE_WITHOUT_QUICKSTART = "onboarding-complete-without-quickstart",
  DIALOG_CONTENT = "onboarding-dialog-content",
  INDICATOR_LIST = "onboarding-indicator-list",
  INDICATOR_LIST_ITEM = "onboarding-indicator-list-item",
  INDICATOR_BUTTON = "onboarding-indicator-button",
  NEXT = "onboarding-next",
  SLIDE = "onboarding-slide",
}

const QUICKSTART_PROJECT_UUID = projectsWithQuickstart.find(
  (project) => project.path === "quickstart"
).uuid;

const expectOnboardingCompleted = () => {
  cy.getOnboardingCompleted().should("equal", "true");
  cy.findByTestId(TEST_ID.DIALOG_CONTENT).should("not.exist");
};

describe("onboarding", () => {
  before(() => {
    cy.clearLocalStorageSnapshot();
  });

  beforeEach(() => {
    cy.visit("/");
  });

  context("has completed onboarding", () => {
    before(() => {
      cy.clearLocalStorageSnapshot();
    });

    beforeEach(() => {
      cy.setOnboardingCompleted("true");
    });

    it("should not show dialog on first visit", () => {
      expectOnboardingCompleted();
    });
  });

  context("hasn't completed onboarding", () => {
    it("should show dialog on first visit", function () {
      cy.getOnboardingCompleted().should("equal", null);

      cy.findByTestId(TEST_ID.DIALOG_CONTENT).should("exist").and("be.visible");
      cy.findByTestId(TEST_ID.NEXT).should("exist").and("be.visible");
    });

    // it("should allow navigation to the next slide", () => {
    //   const visitNextSlideIfPossible = () => {
    //     cy.findByTestId(TEST_ID.DIALOG_CONTENT).then(($dialogContent) => {
    //       const slideLength = $dialogContent[0].getAttribute("data-length");

    //       return;
    //     });
    //   };

    //   visitNextSlideIfPossible();
    // });

    it("should allow navigation to any slide via the indicators", () => {
      cy.findAllByTestId(TEST_ID.INDICATOR_LIST_ITEM).each(
        (listItem, index, listItems) => {
          cy.findAllByTestId(TEST_ID.SLIDE).should(
            "have.attr",
            "data-test-length",
            listItems.length
          );

          cy.wrap(listItem)
            .within(() => {
              cy.findByTestId(TEST_ID.INDICATOR_BUTTON)
                .should("exist")
                .and("be.visible")
                .click();
            })
            .should("have.attr", "aria-current", "step");

          cy.findByTestId(TEST_ID.SLIDE)
            .should("exist")
            .and("have.attr", "data-test-index", index);
        }
      );
    });

    context("has quickstart project", () => {
      before(() => {
        cy.clearLocalStorageSnapshot();
      });

      beforeEach(() => {
        cy.restoreLocalStorage();
      });

      afterEach(() => {
        cy.saveLocalStorage();
      });

      it("should load the quickstart pipeline on completion", () => {
        cy.intercept("GET", "/async/projects", {
          fixture: "async/projects/with-quickstart.json",
        });

        cy.log("Navigate to last slide");
        cy.findAllByTestId(TEST_ID.INDICATOR_BUTTON).last().click();

        cy.findByTestId(TEST_ID.COMPLETE_WITH_QUICKSTART)
          .should("exist")
          .and("be.visible")
          .click()
          .then(() => {
            cy.url()
              .should("include", "/pipeline")
              .and("include", `project_uuid=${QUICKSTART_PROJECT_UUID}`);

            expectOnboardingCompleted();
          });
      });

      it("should not show the dialog again after completion", () => {
        cy.reload();
        expectOnboardingCompleted();
      });
    });

    context("doesn't have quickstart project", () => {
      before(() => {
        cy.clearLocalStorageSnapshot();
      });

      beforeEach(() => {
        cy.restoreLocalStorage();
      });

      afterEach(() => {
        cy.saveLocalStorage();
      });

      it("should close the dialog on completion", () => {
        cy.intercept("GET", "/async/projects", {
          fixture: "async/projects/without-quickstart.json",
        });

        cy.log("Navigate to last slide");
        cy.findAllByTestId(TEST_ID.INDICATOR_BUTTON).last().click();

        cy.findByTestId(TEST_ID.COMPLETE_WITHOUT_QUICKSTART)
          .should("exist")
          .and("be.visible")
          .click()
          .then(() => {
            expectOnboardingCompleted();
          });
      });

      it("should not show the dialog again after completion", () => {
        cy.reload();
        expectOnboardingCompleted();
      });
    });
  });
});
