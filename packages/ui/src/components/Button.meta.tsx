import { ArrowUp, Pen, Trash, X } from "lucide-react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { ButtonProps } from "./Button.tsx";

const pause = <svg aria-hidden width={20} height={20} viewBox="0 0 24 24" fill="currentColor"><rect x={6} y={5} width={4} height={14} rx={1} /><rect x={14} y={5} width={4} height={14} rx={1} /></svg>;
const save = <svg aria-hidden width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></svg>;

const link = () => {
  const onClick = fn();
  return { asChild: true, onClick, children: <a href="#orders" onClick={onClick}>Orders</a> };
};
const disabledLink = link();
const loadingLink = link();

export const tap = async (canvasElement: HTMLElement, name: string) => {
  const button = within(canvasElement).getByRole("button", { name });
  await userEvent.click(button);
  return button;
};

export const tapCalls =
  (name: string, spy: ReturnType<typeof fn>, { args, rest = false }: { args?: unknown[]; rest?: boolean } = {}) =>
  async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    spy.mockClear();
    await tap(canvasElement, name);
    await (args ? expect(spy).toHaveBeenCalledWith(...args) : expect(spy).toHaveBeenCalled());
    if (rest) (document.activeElement as HTMLElement | null)?.blur();
  };

const refusesChild = async (anchor: HTMLElement, onClick: ReturnType<typeof fn>) => {
  await userEvent.click(anchor, { pointerEventsCheck: 0 });
  anchor.focus();
  await userEvent.keyboard("{Enter} ");
  await expect(onClick).not.toHaveBeenCalled();
};

export const meta: ComponentMeta<ButtonProps> = {
  args: { variant: "capsule", size: "pill", children: <>{save}Save all to Files</> },
  examples: {
    AsChild: link(),
    "Disabled link": { ...disabledLink, disabled: true },
    "Loading link": { ...loadingLink, loading: true },
    Empty: { size: "icon", "aria-label": "Add", children: undefined },
    Glass: { variant: "glass", size: "pill", children: <>{pause}Pause</> },
    "Prominent pill": { variant: "prominent", size: "pill", children: <><ArrowUp size={24} strokeWidth={2.4} aria-hidden />Send</> },
    Prominent: { variant: "prominent", size: "compact", children: <><Pen size={22} strokeWidth={2.2} aria-hidden />Write</> },
    Warn: { variant: "warn", size: "pill", children: <><Trash size={22} strokeWidth={2.2} aria-hidden />Delete</> },
    Plain: { variant: "plain", size: "compact-icon", "aria-label": "Close Email", children: <X size={24} strokeWidth={1.75} aria-hidden /> },
  },
  decorator: (story) => <div className="bg-gradient-frame p-6">{story()}</div>,
  play: {
    AsChild: async ({ args, canvasElement }: { args: ButtonProps; canvasElement: HTMLElement }) => {
      await userEvent.click(within(canvasElement).getByRole("link"));
      await expect(args.onClick).toHaveBeenCalled();
    },
    Loading: ({ canvasElement }: { canvasElement: HTMLElement }) => expect(within(canvasElement).getByRole("button").getAttribute("aria-busy")).toBe("true"),
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
