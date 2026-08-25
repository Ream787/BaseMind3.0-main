import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { installStaleBuildHandler } from "./lib/staleDeploy";
import "./styles/index.css";

// Catches chunk failures that happen outside React's error boundary.
installStaleBuildHandler();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
