import { ManagedRuntime } from "effect";
import { act } from "react";
import { expect, it, onTestFinished, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { application } from "../src/app.vibe";
import { actOnScreen, mount } from "./screen.tsx";
import "../src/main.css";

actOnScreen();

it('Dim the tablet at night (spec/app/preferences.md, "Night dimming and sound samples use the current preference without rewriting it")', async () => {
  vi.setSystemTime(new Date(2026, 10, 20, 22, 30));
  onTestFinished(() => { vi.useRealTimers(); });
  const audio = { step: 9, min: 0, max: 15, muted: false };
  let brightness = 100;
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    display: {
      getDevice: () => Promise.resolve({ volume: { ...audio }, brightness: { percent: brightness, night: 30 } }),
      setBrightness: ({ percent }) => { brightness = percent; return Promise.resolve(); },
      setVolume: ({ step, muted }) => { Object.assign(audio, { step, muted }); return Promise.resolve(); },
    },
  }));
  await mount(runtime);
  await expect.poll(() => brightness).toBe(30);
  await act(() => userEvent.click(page.getByRole("button", { name: "Settings", exact: true })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Brightness", exact: true })));
  for (let taps = 0; taps < 8; taps++) await act(() => userEvent.click(page.getByRole("button", { name: "Dimmer", exact: true })));
  await expect.poll(() => brightness).toBe(20);
});
