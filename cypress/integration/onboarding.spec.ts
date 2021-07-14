const LOCAL_STORAGE_KEY = "orchest.onboarding_completed";

enum TEST_ID {
  DIALOG_CONTENT = "onboarding__dialog-content",
  INDICATOR_LIST = "onboarding__indicator-list",
  INDICATOR_LIST_ITEM = "onboarding__indicator-list-item",
  INDICATOR_BUTTON = "onboarding__indicator-button",
  NEXT = "onboarding__next",
}

describe("onboarding", () => {
  context("user hasn't completed onboarding", () => {
    beforeEach(() => {
      cy.restoreLocalStorage();
      cy.visit("/");
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    it("should show dialog on first visit", function () {
      cy.getLocalStorage(LOCAL_STORAGE_KEY).should("equal", null);

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
      cy.findAllByTestId("onboarding__indicator-list-item").each(
        (listItem, index, listItems) => {
          cy.findAllByTestId(TEST_ID.DIALOG_CONTENT).should(
            "have.attr",
            "data-length",
            listItems.length
          );

          cy.wrap(listItem)
            .within(() => {
              cy.findByTestId("onboarding__indicator-button")
                .should("exist")
                .and("be.visible")
                .click();
            })
            .should("have.attr", "aria-current", "step");

          cy.findByTestId(`onboarding__slide-${index}`).should("exist");
        }
      );
    });
  });

  context("user has completed onboarding", () => {
    beforeEach(() => {
      cy.setLocalStorage(LOCAL_STORAGE_KEY, "true");
      cy.visit("/");
    });

    afterEach(() => {
      cy.saveLocalStorage();
    });

    it("should not show dialog on first visit", () => {
      cy.findByTestId(TEST_ID.DIALOG_CONTENT).should("not.exist");
    });
  });
});
