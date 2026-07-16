import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { usePlayerStore } from "./store";
import { AppErrorBoundary } from "./components/AppErrorBoundary";

document.documentElement.lang = usePlayerStore.getState().preferences.language;

async function bootstrap() {
  if (import.meta.env.VITE_E2E === "1") await import("@wdio/tauri-plugin");
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
}

void bootstrap();
