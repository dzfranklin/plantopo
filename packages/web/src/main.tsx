import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Root } from "./Root.tsx";

import "./auth/auth-client.ts";
import "./index.css";

import { getDebugFlag } from "./hooks/debug-flags.ts";
import { mockNative } from "./mock-native.ts";

if (getDebugFlag("mockNative")) {
  window.Native = mockNative();
}

if (window.Native && !window.__INITIAL_USER__) {
  window.Native.reportUnauthorized();
  throw new Error("No initial user in native");
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
