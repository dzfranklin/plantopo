import { setupWorker } from "msw/browser";

import { defaultHandlers } from "./handlers";

export const server = setupWorker(...defaultHandlers);
