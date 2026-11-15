import { Pen, X } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { ButtonProps } from "./Button.tsx";

// The prototype's own drawings of these two, which differ from Lucide's.
const pause = <svg aria-hidden width={20} height={20} viewBox="0 0 24 24" fill="currentColor"><rect x={6} y={5} width={4} height={14} rx={1} /><rect x={14} y={5} width={4} height={14} rx={1} /></svg>;
const save = <svg aria-hidden width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>;

const link = () => {
  const onClick = fn();
  return { asChild: true, onClick, children: <a href="#orders" onClick={onClick}>Orders</a> };
};
const disabledLink = link();
const loadingLink = link();

const refusesChild = async (anchor: HTMLElement, onClick: ReturnType<typeof fn>) => {
  await userEvent.click(anchor, { pointerEventsCheck: 0 });
  anchor.focus();
  await userEvent.keyboard("{Enter} ");
  await expect(onClick).not.toHaveBeenCalled();
};

export const meta: ComponentMeta<ButtonProps> = {
  examples: {
    // `asChild` needs an element to become, which no type can supply.
    AsChild: link(),
    "Disabled link": { ...disabledLink, disabled: true },
    "Loading link": { ...loadingLink, loading: true },
    // A button without text is named by `aria-label`.
    Empty: { size: "icon", "aria-label": "Add", children: undefined },
    // The tablet's kinds (prototype .pill, .pill.prom and .winx in the Email header, .a-btn in a read email).
    Glass: { variant: "glass", size: "pill", children: <>{pause}Pause</> },
    Prominent: { variant: "prominent", size: "compact", children: <><Pen size={22} strokeWidth={2.2} aria-hidden />Write</> },
    Capsule: { variant: "capsule", size: "pill", children: <>{save}Save all to Files</> },
    Plain: { variant: "plain", size: "compact-icon", "aria-label": "Close Email", children: <X size={24} strokeWidth={1.75} aria-hidden /> },
  },
  // The tablet's buttons sit on its frame, where clear glass shows.
  decorator: (story) => <div className="bg-gradient-frame p-6">{story()}</div>,
  // The generated play of a disabled or loading story checks that it refuses clicks and keys; these check what a person is told.
  play: {
    AsChild: async ({ args, canvasElement }: { args: ButtonProps; canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("link"));
      await expect(args.onClick).toHaveBeenCalled();
    },
    Loading: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("button").getAttribute("aria-busy")).toBe("true"),
    // A link has no `disabled`: it says so and leaves the tab order.
    "Disabled link": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const anchor = within(canvasElement).getByRole("link");
      await expect([anchor.getAttribute("aria-disabled"), anchor.tabIndex]).toEqual(["true", -1]);
      await refusesChild(anchor, disabledLink.onClick);
    },
    "Loading link": async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const anchor = within(canvasElement).getByRole("link");
      await expect([anchor.getAttribute("aria-disabled"), anchor.getAttribute("aria-busy"), anchor.tabIndex]).toEqual(["true", "true", -1]);
      await refusesChild(anchor, loadingLink.onClick);
    },
  },
};
