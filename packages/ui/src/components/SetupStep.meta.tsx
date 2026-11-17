import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { onTablet } from "./CalendarApp.meta.tsx";
import { GraceActionLine } from "./GraceActionLine.tsx";
import { GraceBubble } from "./GraceBubble.tsx";
import { GraceDock } from "./GraceDock.tsx";
import { SecretField } from "./SecretField.tsx";
import type { SetupStepProps } from "./SetupStep.tsx";
import { UserBubble } from "./UserBubble.tsx";
import { ValueCards } from "./ValueCards.tsx";

const at = (title: string, step: number) => ({ title, step, total: 17 });
const answered = fn();
const closed = fn();

const dock = (turn: "margaret" | "listening" | "grace" = "margaret") => (
  <GraceDock value="" setup listening={turn === "listening"} quiet={turn === "grace"} placeholder={turn === "margaret" ? "Talk or tap to type" : ""} />
);
const networks = [
  { id: "home", value: "Smith Family Wi-Fi", detail: "Strong signal" },
  { id: "guest", value: "Smith Guest", detail: "Good signal" },
  { id: "cafe", value: "Corner Cafe", detail: "Weak signal" },
];
const named = (
  <>
    <GraceBubble>Hi, I’m Grace. I’ll help you with everyday things on this tablet. What’s your name?</GraceBubble>
    <UserBubble>Margaret</UserBubble>
  </>
);
const connected = <GraceActionLine tone="result">Connected to Smith Family Wi-Fi.</GraceActionLine>;

export const meta: ComponentMeta<SetupStepProps> = {
  args: {
    progress: at("Saying hello", 1),
    children: <GraceBubble>Hi, I’m Grace. I’ll help you with everyday things on this tablet. What’s your name?</GraceBubble>,
    dock: dock(),
    onAnswer: answered,
    onClose: closed,
  },
  decorator: onTablet,
  examples: {
    Internet: {
      progress: at("Internet", 3),
      language: undefined,
      children: (
        <>
          {named}
          <GraceBubble>Nice to meet you, Margaret. Let’s connect to your internet so I can help properly.</GraceBubble>
          <GraceActionLine tone="record">Looking for networks…</GraceActionLine>
          <GraceBubble>Found them. Which of these is yours?</GraceBubble>
          <ValueCards label="Networks" options={networks} onPick={fn()} />
        </>
      ),
    },
    Password: {
      progress: at("Internet password", 4),
      language: undefined,
      children: (
        <>
          <UserBubble>Smith Family Wi-Fi</UserBubble>
          <GraceBubble>What’s the password for Smith Family Wi-Fi? It’s usually on a sticker on your internet box. This tablet will remember it, so you only type it once.</GraceBubble>
        </>
      ),
      dock: <SecretField label="Password for Smith Family Wi-Fi" onSubmit={fn()} />,
    },
    "Wrong password": {
      progress: at("Internet password", 4),
      language: undefined,
      children: (
        <>
          <GraceActionLine>You typed the password.</GraceActionLine>
          <GraceActionLine tone="problem">That password didn’t work.</GraceActionLine>
          <GraceBubble>Passwords are easy to mistype, so it’s not you. Nothing has changed. Shall we try it again, or carry on without internet for now?</GraceBubble>
        </>
      ),
      answers: ["Try again", "Carry on without it"],
    },
    Account: {
      progress: at("Your account", 6),
      language: undefined,
      children: (
        <>
          {connected}
          <GraceBubble>You’re connected. Now I’ll make your account. It’s how I know it’s you, and how I keep your things private. What’s your email address?</GraceBubble>
        </>
      ),
      answers: ["Use my mobile number instead"],
      dock: dock("listening"),
    },
    Pace: {
      progress: at("Speaking pace", 7),
      language: undefined,
      children: (
        <>
          <GraceActionLine tone="result">Email confirmed. Account created.</GraceActionLine>
          <GraceBubble>How does this speaking pace feel? Say slower, faster, or stay at this speed.</GraceBubble>
        </>
      ),
      answers: ["Slower", "Stay at this speed", "Faster"],
    },
    "Text size": {
      progress: at("Text size", 8),
      language: undefined,
      children: (
        <>
          <UserBubble>Slower</UserBubble>
          <GraceBubble>I’ll speak a little slower from now on. Next, text size. Is this easy to read, or would you like it bigger?</GraceBubble>
        </>
      ),
      answers: ["Bigger", "That’s good", "Smaller"],
    },
    "Stepping aside": {
      progress: at("Stepping aside", 11),
      language: undefined,
      children: <GraceBubble>Now tap Close. I’ll wait at the edge of the screen until you need me.</GraceBubble>,
      tasksCount: 1,
      onTasks: fn(),
      guide: "close",
      dock: dock("grace"),
    },
    Tasks: {
      progress: at("Tasks", 13),
      language: undefined,
      children: <GraceBubble>Welcome back. You may have noticed Tasks at the top. Anything we work on together is kept there, finished or not. Tap it to have a look.</GraceBubble>,
      tasksCount: 1,
      onTasks: fn(),
      guide: "tasks",
      dock: dock("grace"),
    },
    Ready: {
      progress: at("Ready", 17),
      language: undefined,
      children: (
        <>
          <GraceActionLine>You tapped Continue.</GraceActionLine>
          <GraceBubble>That’s everything — you can change any of these at any time, just tell me. Would you like to try something together now, or look around on your own first?</GraceBubble>
        </>
      ),
      answers: ["Try something together", "On my own"],
      tasksCount: 1,
      onTasks: fn(),
    },
    "Save failed": {
      progress: at("Ready", 17),
      language: undefined,
      children: (
        <>
          <UserBubble>On my own</UserBubble>
          <GraceActionLine tone="problem">Your choices aren’t saved yet. They’re still in use on this tablet.</GraceActionLine>
        </>
      ),
      answers: ["Retry saving choices", "Continue without saving"],
      tasksCount: 1,
      onTasks: fn(),
    },
  },
  play: {
    Pace: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      answered.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Slower" }));
      await expect(answered).toHaveBeenCalledWith("Slower");
    },
    "Stepping aside": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      closed.mockClear();
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Close" }));
      await expect(closed).toHaveBeenCalled();
    },
  },
};
