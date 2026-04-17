import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Root } from "./Root.tsx";

import "./auth/auth-client.ts";
import "./index.css";

if (window.Native && !window.__INITIAL_SESSION__) {
  window.Native.reportUnauthorized();
  throw new Error("No initial session in native");
}

const root = createRoot(document.getElementById("root")!);

if (localStorage.getItem("_disableStrictMode")) {
  console.warn(
    "StrictMode is disabled. To re-enable, run localStorage.removeItem('_disableStrictMode') in the console.",
  );
  root.render(<Root />);
} else {
  root.render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
}
