import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, beforeAll, onTestFinished } from "vitest";
import { page } from "vitest/browser";
import { App } from "../src/App.tsx";
import type { Runtime } from "../src/useApp.ts";

export function tabletViewport() {
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  beforeAll(async () => {
    environment.IS_REACT_ACT_ENVIRONMENT = true;
    await page.viewport(1280, 800);
  });
  afterAll(() => { environment.IS_REACT_ACT_ENVIRONMENT = false; });
}

export function tabletView(runtime: Runtime) {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  return {
    render: () => act(() => Promise.resolve(root.render(<App runtime={runtime} />))),
    dispose: async () => {
      await act(() => Promise.resolve(root.unmount()));
      await runtime.dispose();
      host.remove();
    },
  };
}

export async function mountTablet(runtime: Runtime) {
  const view = tabletView(runtime);
  onTestFinished(view.dispose);
  await view.render();
}
