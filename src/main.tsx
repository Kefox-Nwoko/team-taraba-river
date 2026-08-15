import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";
import "./index.css";

// Register the offline/service worker in production builds only, so the dev
// server (Vite HMR) is never intercepted by a stale cache.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is progressive — ignore registration failures */
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>
);
