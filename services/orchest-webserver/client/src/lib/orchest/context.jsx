// @ts-check
import React from "react";

/**
 * @type {React.Context<import("@/types").IOrchestContext>}
 */
export const OrchestContext = React.createContext(null);

export const useOrchest = () => React.useContext(OrchestContext);
