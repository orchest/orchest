import { setupServer } from "msw/node";
import { handlers } from "./handlers.mock";

export const server = setupServer(...handlers);
