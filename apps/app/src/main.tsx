import "@repo/ui/fonts";
import { ManagedRuntime } from "effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { application } from "./app.vibe";
import { devicePlugin, wifiPlugin, passwordClient } from "./surfacePlugin.ts";
import "./main.css";

createRoot(document.getElementById("root")!).render(<StrictMode><App runtime={ManagedRuntime.make(application(devicePlugin, wifiPlugin, undefined, passwordClient))} /></StrictMode>);
