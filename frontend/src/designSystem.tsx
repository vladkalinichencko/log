import React from "react";
import ReactDOM from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { DesignSystem } from "./components/DesignSystem";
import "./styles/tokens.css";
import "./styles/design-system.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MemoryRouter>
      <DesignSystem />
    </MemoryRouter>
  </React.StrictMode>
);
