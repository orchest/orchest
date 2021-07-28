import * as React from "react";
import type { IOrchestContext } from "@/types";

export const OrchestContext = React.createContext<IOrchestContext>(null);

export const useOrchest = () => React.useContext(OrchestContext);
