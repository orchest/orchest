import projectsWithQuickstart from "../fixtures/async/projects/with-quickstart.json";
import { reset, TEST_ID } from "../support/common";

const QUICKSTART_PROJECT_UUID = projectsWithQuickstart.find(
  (project) => project.path === "quickstart"
).uuid;

describe("onboarding", () => {
  beforeEach(() => {
    cy.disableCheckUpdate();
  });
  context("should be visible", () => {
    beforeEach(() => {
      reset();
      cy.clearLocalStorageSnapshot();
    });

    afterEach(() => {
      cy.findByTestId(TEST_ID.ONBOARDING_DIALOG_CONTENT)
        .should("exist")
        .and("be.visible");
    });

    context("on first visit", () => {
      ["/", "/help"].map((view) => {
        it(`in ${view}`, () => {
          cy.visit(view);
          cy.getOnboardingCompleted().should("equal", null);
        });
      });
    });

    context("when toggled", () => {
      ["/help"].map((view) => {
        it(`in ${view}`, () => {
          cy.setOnboardingCompleted("true");
          cy.visit(view);
          cy.findByTestId(TEST_ID.ONBOARDING_OPEN).should("exist").click();
        });
      });
    });
  });

  context("should not be visible", () => {
    beforeEach(() => {
      cy.clearLocalStorageSnapshot();
      cy.visit("/");
    });

    afterEach(() => {
      const expectOnboardingCompleted = () => {
        cy.findByTestId(TEST_ID.ONBOARDING_DIALOG_CONTENT).should("not.exist");
        cy.getOnboardingCompleted().should("equal", "true");
      };

      expectOnboardingCompleted();
      cy.reload().then(() => {
        expectOnboardingCompleted();
      });
    });

    // The plan was originally to add a test for closing the overlay, but
    // cypress seems to make this fairly difficult. For now we'll assume that
    // this is tested on the Radix side – if our close button works.

    it("when the 'close' button is pressed", () => {
      cy.findByTestId(TEST_ID.ONBOARDING_CLOSE).click();
    });

    it("if user has already completed onboarding", () => {
      cy.setOnboardingCompleted("true");
    });

    context("if user has just completed onboarding", () => {
      [true, false].map((withQuickstart) => {
        it(`${withQuickstart ? "with" : "without"} quickstart pipeline`, () => {
          cy.intercept("GET", "/async/projects*", {
            fixture: `async/projects/${
              withQuickstart ? "with" : "without"
            }-quickstart.json`,
          });

          cy.findAllByTestId(TEST_ID.ONBOARDING_INDICATOR_BUTTON)
            .last()
            .click()
            .then(() => {
              cy.findByTestId(
                withQuickstart
                  ? TEST_ID.ONBOARDING_COMPLETE_WITH_QUICKSTART
                  : TEST_ID.ONBOARDING_COMPLETE_WITHOUT_QUICKSTART
              )
                .should("exist")
                .and("be.visible")
                .click()
                .then(() => {
                  if (!withQuickstart) {
                    return;
                  }

                  cy.log("Should redirect to pipeline");
                  cy.url()
                    .should("include", "/pipeline")
                    .and("include", `project_uuid=${QUICKSTART_PROJECT_UUID}`);
                });
            });
        });
      });
    });
  });

  context("should allow navigation", () => {
    it("via the 'next' button", () => {
      const visitNextSlideIfPossible = () => {
        cy.findByTestId(TEST_ID.ONBOARDING_SLIDE).then(($slide) => {
          const index = parseFloat($slide.attr("data-test-index"));
          const length = parseFloat($slide.attr("data-test-length"));

          if (index === length - 1) {
            cy.log("prevent forwards navigation on the last slide");
            cy.findByTestId(TEST_ID.ONBOARDING_NEXT).should("not.exist");
            return;
          }

          cy.findByTestId(TEST_ID.ONBOARDING_NEXT)
            .should("exist")
            .and("be.visible")
            .click()
            .then(() => {
              cy.findByTestId(TEST_ID.ONBOARDING_SLIDE).should(
                "have.attr",
                "data-test-index",
                `${index + 1}`
              );
            });
          visitNextSlideIfPossible();
        });
      };

      reset();
      cy.clearLocalStorageSnapshot();

      visitNextSlideIfPossible();
    });

    it("via the indicators", () => {
      cy.findAllByTestId(TEST_ID.ONBOARDING_INDICATOR_LIST_ITEM).each(
        (listItem, index, listItems) => {
          cy.findAllByTestId(TEST_ID.ONBOARDING_SLIDE).should(
            "have.attr",
            "data-test-length",
            listItems.length
          );

          cy.wrap(listItem)
            .within(() => {
              cy.findByTestId(TEST_ID.ONBOARDING_INDICATOR_BUTTON)
                .should("exist")
                .and("be.visible")
                .click();
            })
            .should("have.attr", "aria-current", "step");

          cy.findByTestId(TEST_ID.ONBOARDING_SLIDE)
            .should("exist")
            .and("have.attr", "data-test-index", index);
        }
      );
    });
  });
});
