import "cypress-localstorage-commands";
import "@testing-library/cypress/add-commands";

type TBooleanString = "true" | "false";

declare global {
  namespace Cypress {
    interface Chainable {
      setOnboardingCompleted(value: TBooleanString): void;
      getOnboardingCompleted(): Chainable<TBooleanString>;
    }
  }
}

const LOCAL_STORAGE_KEY = "orchest.onboarding_completed";

Cypress.Commands.add("setOnboardingCompleted", (value: TBooleanString) => {
  cy.setLocalStorage(LOCAL_STORAGE_KEY, value);
});

Cypress.Commands.add("getOnboardingCompleted", () =>
  cy.getLocalStorage(LOCAL_STORAGE_KEY)
);

before(() => {
  cy.configureCypressTestingLibrary({ testIdAttribute: "data-test-id" });
});
