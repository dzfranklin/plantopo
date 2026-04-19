// This checks a debug flag and if enabled mocks window.Native
import "./mock-native.ts";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Root } from "./Root.tsx";

import "./auth/auth-client.ts";
import "./index.css";

import { getDebugFlag } from "./hooks/debug-flags.ts";

if (window.Native && !window.__INITIAL_SESSION__) {
  window.Native.reportUnauthorized();
  throw new Error("No initial session in native");
}

const root = createRoot(document.getElementById("root")!);

if (getDebugFlag("disableStrictMode")) {
  console.warn("StrictMode is disabled via debug flag");
  root.render(<Root />);
} else {
  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
