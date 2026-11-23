import { Effect, Latch, Layer, ManagedRuntime } from "effect";
import { TestClock } from "effect/testing";
import { act } from "react";
import { expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import { application } from "../src/app.vibe";
import { actOnScreen, mount, tabletView } from "./screen.tsx";
import "../src/main.css";

actOnScreen();

const tap = (button: Element) => button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

it('Dim the tablet at night (spec/app/preferences.md, "Night dimming and sound samples use the current preference without rewriting it")', async () => {
  const clock = Layer.effectDiscard(TestClock.setTime(new Date(2026, 10, 20, 6, 58).getTime())).pipe(Layer.provideMerge(TestClock.layer()));
  const audio = { step: 9, min: 0, max: 15, muted: false };
  let brightness = 100;
  let acceptsBrightness = true;
  const runtime = ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    display: {
      getDevice: () => Promise.resolve({ volume: { ...audio }, brightness: { percent: brightness } }),
      setBrightness: ({ percent }) => { if (acceptsBrightness) brightness = percent; return Promise.resolve(); },
      setVolume: ({ step, muted }) => { Object.assign(audio, { step, muted }); return Promise.resolve(); },
    },
  }).pipe(Layer.provideMerge(clock)));
  await mount(runtime);
  await expect.poll(() => brightness).toBe(50);
  await act(() => userEvent.click(page.getByRole("button", { name: "Settings", exact: true })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Brightness", exact: true })));
  const toggle = page.getByRole("switch", { name: "Dim the screen at night" });
  acceptsBrightness = false;
  await act(() => userEvent.click(toggle));
  await expect.element(page.getByText("The tablet couldn’t apply that setting.")).toBeVisible();
  expect(brightness).toBe(50);
  acceptsBrightness = true;
  await act(() => runtime.runPromise(TestClock.adjust("1 minute")));
  await expect.poll(() => brightness).toBe(100);
  await act(() => userEvent.click(toggle));
  await expect.poll(() => brightness).toBe(50);
  for (let taps = 0; taps < 8; taps++) await act(() => userEvent.click(page.getByRole("button", { name: "Dimmer", exact: true })));
  await expect.poll(() => brightness).toBe(20);
  for (let taps = 0; taps < 4; taps++) await act(() => userEvent.click(page.getByRole("button", { name: "Brighter", exact: true })));
  await expect.poll(() => brightness).toBe(30);
  await act(() => runtime.runPromise(TestClock.adjust("1 minute")));
  await expect.poll(() => brightness).toBe(60);
  const dimmer = page.getByRole("button", { name: "Dimmer", exact: true }).element();
  await act(async () => {
    tap(dimmer);
    tap(dimmer);
    await expect.poll(() => brightness).toBe(40);
    tap(dimmer);
  });
  await expect.poll(() => brightness).toBe(30);
  const workspace = await runtime.runPromise(Workspaces);
  await act(async () => {
    await runtime.runPromise(workspace.send({ type: "undoPreferences" }, "Person"));
    await expect.poll(() => brightness).toBe(40);
    tap(dimmer);
  });
  await expect.poll(() => brightness).toBe(30);
});

it('Keep mute after a failed save and restart (spec/app/preferences.md, "Only the current storage acknowledgement confirms persistence")', async () => {
  const stored: { revision: number; value: string | null } = { revision: 0, value: null };
  let acceptsWrites = false;
  let refused = 0;
  const clock = Layer.effectDiscard(TestClock.setTime(new Date(2026, 10, 20, 12).getTime())).pipe(Layer.provideMerge(TestClock.layer()));
  const audio = { step: 9, min: 0, max: 15, muted: false };
  let brightness = 100;
  const device = () => ({ volume: { ...audio }, brightness: { percent: brightness } });
  let reportVolume: (() => void) | undefined;
  let nextRead: Promise<ReturnType<typeof device>> | undefined;
  const start = () => ManagedRuntime.make(application(undefined, undefined, {
    native: true,
    display: {
      getDevice: () => {
        const pending = nextRead;
        nextRead = undefined;
        return pending ?? Promise.resolve(device());
      },
      setBrightness: ({ percent }) => { brightness = percent; return Promise.resolve(); },
      setVolume: (choice) => { Object.assign(audio, choice); return Promise.resolve(); },
      addListener: (_, listener) => {
        reportVolume = listener;
        return Promise.resolve({ remove: () => { reportVolume = undefined; return Promise.resolve(); } });
      },
    },
    preferences: {
      read: () => Promise.resolve({ ...stored }),
      write: ({ revision, value }) => {
        if (!acceptsWrites || revision !== stored.revision) return Promise.reject(new Error(`refused ${++refused}`));
        Object.assign(stored, { revision: revision + 1, value });
        return Promise.resolve({ revision: stored.revision });
      },
    },
  }).pipe(Layer.provideMerge(clock)));
  const runtime = start();
  const first = tabletView(runtime);
  try {
    await first.render();
    await act(() => userEvent.click(page.getByRole("button", { name: "Volume", exact: true })));
    await act(() => userEvent.click(page.getByRole("button", { name: "Mute", exact: true })));
    await expect.element(page.getByText("Muted")).toBeVisible();
    await expect.poll(() => refused).toBe(1);
    acceptsWrites = true;
    await act(() => runtime.runPromise(TestClock.adjust("1 minute")));
    await expect.poll(() => stored.revision).toBe(1);
  } finally {
    await first.dispose();
  }
  await mount(start());
  await act(() => userEvent.click(page.getByRole("button", { name: "Volume", exact: true })));
  await expect.element(page.getByText("Muted")).toBeVisible();
  const louder = page.getByRole("button", { name: "Louder", exact: true }).element();
  await act(() => Promise.resolve().then(() => { tap(louder); tap(louder); }));
  await expect.element(page.getByRole("slider", { name: "Volume" })).toHaveAttribute("aria-valuenow", "20");
  await expect.poll((): unknown => JSON.parse(stored.value ?? "{}")).toMatchObject({ muted: false, volume: 20 });
  await expect.poll(() => audio.step).toBe(3);
  await expect.poll(() => reportVolume).toBeTypeOf("function");
  const delayed = Latch.makeUnsafe();
  const concurrent = Latch.makeUnsafe();
  onTestFinished(() => { delayed.openUnsafe(); concurrent.openUnsafe(); });
  audio.step = 6;
  const stale = device();
  nextRead = Effect.runPromise(delayed.await).then(() => stale);
  reportVolume?.();
  await expect.poll(() => nextRead === undefined).toBe(true);
  await act(() => userEvent.click(page.getByRole("button", { name: "Louder", exact: true })));
  delayed.openUnsafe();
  await expect.poll(() => audio.step).toBe(5);
  await expect.poll((): unknown => JSON.parse(stored.value ?? "{}")).toMatchObject({ muted: false, volume: 30 });
  await act(() => userEvent.click(page.getByRole("button", { name: "Close", exact: true })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Settings", exact: true })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Brightness", exact: true })));
  audio.step = 9;
  const raised = device();
  nextRead = Effect.runPromise(concurrent.await).then(() => raised);
  reportVolume?.();
  await expect.poll(() => nextRead === undefined).toBe(true);
  await act(() => userEvent.click(page.getByRole("button", { name: "Dimmer", exact: true })));
  concurrent.openUnsafe();
  await expect.poll(() => brightness).toBe(90);
  await expect.poll((): unknown => JSON.parse(stored.value ?? "{}")).toMatchObject({ muted: false, volume: 60, brightness: 90 });
  await act(() => userEvent.click(page.getByRole("button", { name: "Close Settings", exact: true })));
  await act(() => userEvent.click(page.getByRole("button", { name: "Volume", exact: true })));
  await expect.element(page.getByRole("slider", { name: "Volume" })).toHaveAttribute("aria-valuenow", "60");
  nextRead = Promise.resolve({ ...device(), volume: { ...audio, step: 10 } });
  audio.step = 11;
  reportVolume?.();
  reportVolume?.();
  await expect.element(page.getByRole("slider", { name: "Volume" })).toHaveAttribute("aria-valuenow", "73");
  await expect.poll((): unknown => JSON.parse(stored.value ?? "{}")).toMatchObject({ muted: false, volume: 73 });
  expect(audio.step).toBe(11);
});
