// For some baffling reason, we can't use TypeScript to type-check plugins.
// So we need to rely on JSDoc instead.

/// <reference types="cypress" />

/**
 * @type {Cypress.PluginConfig}
 */
module.exports = (on, config) => {
  // `on` is used to hook into various events Cypress emits
  // `config` is the resolved Cypress config
};
