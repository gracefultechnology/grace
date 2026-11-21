import { Layer, ManagedRuntime } from "effect";
import { TestClock } from "effect/testing";
import { act } from "react";
import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { application } from "../src/app.vibe";
import { actOnScreen, mount } from "./screen.tsx";
import "../src/main.css";

actOnScreen();

it('Dim the tablet at night (spec/app/preferences.md, "Night dimming and sound samples use the current preference without rewriting it")', async () => {
  const clock = Layer.effectDiscard(TestClock.setTime(new Date(2026, 10, 20, 6, 58).getTime())).pipe(Layer.provideMerge(TestClock.layer()));
  const audio = { step: 9, min: 0, max: 15, muted: false };
  let brightness = 100;
  let acceptsBrightness = true;
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    display: {
      getDevice: () => Promise.resolve({ volume: { ...audio }, brightness: { percent: brightness, night: 30 } }),
      setBrightness: ({ percent }) => { if (acceptsBrightness) brightness = percent; return Promise.resolve(); },
      setVolume: ({ step, muted }) => { Object.assign(audio, { step, muted }); return Promise.resolve(); },
    },
  }).pipe(Layer.provideMerge(clock)));
  await mount(runtime);
  await expect.poll(() => brightness).toBe(30);
  await act(() => userEvent.click(page.getByRole("button", { name: "Settings", exact: true })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Brightness", exact: true })));
  const toggle = page.getByRole("switch", { name: "Dim the screen at night" });
  acceptsBrightness = false;
  await act(() => userEvent.click(toggle));
  await expect.element(page.getByText("The tablet couldn’t apply that setting.")).toBeVisible();
  expect(brightness).toBe(30);
  acceptsBrightness = true;
  await act(() => runtime.runPromise(TestClock.adjust("1 minute")));
  await expect.poll(() => brightness).toBe(100);
  await act(() => userEvent.click(toggle));
  await expect.poll(() => brightness).toBe(30);
  for (let taps = 0; taps < 8; taps++) await act(() => userEvent.click(page.getByRole("button", { name: "Dimmer", exact: true })));
  await expect.poll(() => brightness).toBe(20);
  for (let taps = 0; taps < 2; taps++) await act(() => userEvent.click(page.getByRole("button", { name: "Brighter", exact: true })));
  await expect.poll(() => brightness).toBe(30);
  await act(() => runtime.runPromise(TestClock.adjust("1 minute")));
  await expect.poll(() => brightness).toBe(40);
});
