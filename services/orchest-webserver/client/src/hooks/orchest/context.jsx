// @ts-check
import React from "react";

/**
 * @typedef {import("@/types").IOrchestContext} IOrchestContext
 * @type {React.Context<IOrchestContext>}
 */
export const OrchestContext = React.createContext(null);

export const useOrchest = () => React.useContext(OrchestContext);
