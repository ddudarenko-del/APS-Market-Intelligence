import React from "react";
import { createRoot } from "react-dom/client";
import { MarketDashboard } from "./app/MarketDashboard";
import "./app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element is missing");
}

createRoot(root).render(
  <React.StrictMode>
    <MarketDashboard />
  </React.StrictMode>,
);
