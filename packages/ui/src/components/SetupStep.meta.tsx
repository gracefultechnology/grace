import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { AccountSignIn } from "./AccountSignIn.tsx";
import { onTablet } from "./CalendarApp.meta.tsx";
import { GraceDock } from "./GraceDock.tsx";
import { SegmentedControl } from "./SegmentedControl.tsx";
import { speeds, textSizePreview, textSizes } from "./SettingsApp.meta.tsx";
import { SettingsTextSize } from "./SettingsTextSize.tsx";
import type { SetupStepProps } from "./SetupStep.tsx";
import { WifiNetworkList } from "./WifiNetworkList.tsx";
import { nearby } from "./WifiNetworkList.meta.tsx";

const at = (title: string, step: number) => ({ title, step, total: 10 });
const joined = fn();
const signedIn = fn();
const sent = fn();
const paced = fn();
const talked = fn();
const typed = fn();
const answered = fn();
const putOff = fn();
const closed = fn();

const accountLine = "Connect your email so I can read your email and calendar to help you. I send an email, move one to Trash or change an event only when you say so.";
const notNowAccount = { cost: "Grace can’t help until your email is connected.", onNotNow: putOff };
const learnLater = { cost: "You can try it later in Grace’s window.", onNotNow: putOff };
const next = { label: "Next", onAction: answered };
const practice = (onTalk?: () => void, onType?: () => void) => <GraceDock value="" setup placeholder="Talk or tap to type" onTalk={onTalk} onType={onType} />;

type Play = { canvasElement: HTMLElement };
const tap = async (canvasElement: HTMLElement, name: string) => userEvent.click(within(canvasElement).getByRole("button", { name }));

export const meta: ComponentMeta<SetupStepProps> = {
  args: {
    progress: at("Wi-Fi", 1),
    line: "Let’s get on the internet first. Which network is yours?",
    content: <WifiNetworkList networks={nearby} offlineHint="" onSelect={joined} />,
    notNow: { cost: "Grace needs the internet to think and speak.", onNotNow: putOff },
    onClose: closed,
  },
  decorator: onTablet,
  examples: {
    "No internet": {
      progress: at("Your email", 2),
      line: "Connecting your email needs the internet.",
      content: <AccountSignIn state="offline" />,
      action: { label: "Connect to Wi-Fi", onAction: answered },
      notNow: notNowAccount,
    },
    Account: {
      progress: at("Your email", 2),
      line: accountLine,
      content: <AccountSignIn state="ready" onContinue={signedIn} />,
      notNow: notNowAccount,
    },
    "Sign-in cancelled": {
      progress: at("Your email", 2),
      line: accountLine,
      content: <AccountSignIn state="cancelled" onContinue={signedIn} />,
      notNow: notNowAccount,
    },
    Name: {
      progress: at("Your name", 3),
      line: "What would you like me to call you?",
      speaking: true,
      content: undefined,
      notNow: { cost: "I’ll greet you without a name. You can add it in Settings.", onNotNow: putOff },
      dock: <GraceDock value="Margaret" setup composerOpen onSend={sent} />,
    },
    Pace: {
      progress: at("Speaking pace", 4),
      line: "How does this pace sound? Choose one to hear it.",
      speaking: true,
      content: <SegmentedControl aria-label="How fast Grace speaks" options={speeds} value="1" onValueChange={paced} />,
      action: next,
      notNow: { cost: "Your pace stays as it is. You can change it in Settings.", onNotNow: putOff },
    },
    "Text size": {
      progress: at("Text size", 5),
      line: "Is this easy to read? Choose a size to see it.",
      content: <SettingsTextSize sizes={textSizes} value="Larger" {...textSizePreview} />,
      action: { ...next, saving: true },
      notNow: { cost: "Your text size stays as it is. You can change it in Settings.", onNotNow: putOff },
    },
    "What Grace does": {
      progress: at("What Grace does", 6),
      line: "I help with your email, calendar and websites. While the microphone is on, your voice goes over the internet to be understood, and my replies come back to be spoken.",
      speaking: true,
      content: undefined,
      action: next,
      notNow: undefined,
    },
    Talk: {
      progress: at("Talk", 7),
      line: "Tap Talk and say hello.",
      speaking: true,
      content: undefined,
      ring: "talk",
      notNow: learnLater,
      dock: practice(talked),
    },
    Type: {
      progress: at("Type", 8),
      line: "Now tap Type and write hello.",
      content: undefined,
      ring: "type",
      notNow: learnLater,
      dock: practice(undefined, typed),
    },
    Close: {
      progress: at("Close", 9),
      line: "Tap Close. Ask Grace brings me back.",
      content: undefined,
      ring: "close",
      notNow: learnLater,
      dock: practice(),
    },
    "Save failed": {
      progress: undefined,
      line: "Your set-up isn’t saved yet.",
      content: undefined,
      action: { label: "Retry", onAction: answered },
      notNow: undefined,
    },
  },
  play: {
    Default: async ({ canvasElement }: Play) => {
      joined.mockClear();
      putOff.mockClear();
      await tap(canvasElement, "NETGEAR-4F2");
      await expect(joined).toHaveBeenCalledWith("NETGEAR-4F2");
      await tap(canvasElement, "Not now");
      await expect(putOff).toHaveBeenCalled();
    },
    "No internet": async ({ canvasElement }: Play) => {
      answered.mockClear();
      await tap(canvasElement, "Connect to Wi-Fi");
      await expect(answered).toHaveBeenCalled();
    },
    Account: async ({ canvasElement }: Play) => {
      signedIn.mockClear();
      putOff.mockClear();
      await tap(canvasElement, "Continue with Google");
      await expect(signedIn).toHaveBeenCalled();
      await tap(canvasElement, "Not now");
      await expect(putOff).toHaveBeenCalled();
    },
    "Sign-in cancelled": async ({ canvasElement }: Play) => {
      signedIn.mockClear();
      await tap(canvasElement, "Continue with Google");
      await expect(signedIn).toHaveBeenCalled();
    },
    Name: async ({ canvasElement }: Play) => {
      sent.mockClear();
      await tap(canvasElement, "Send");
      await expect(sent).toHaveBeenCalled();
    },
    Pace: async ({ canvasElement }: Play) => {
      paced.mockClear();
      answered.mockClear();
      await userEvent.click(within(canvasElement).getByRole("radio", { name: "Slower" }));
      await expect(paced).toHaveBeenCalledWith("0.8");
      await tap(canvasElement, "Next");
      await expect(answered).toHaveBeenCalled();
    },
    "Text size": async ({ canvasElement }: Play) => {
      putOff.mockClear();
      await expect(within(canvasElement).getByRole("button", { name: "Next" })).toBeDisabled();
      await tap(canvasElement, "Not now");
      await expect(putOff).toHaveBeenCalled();
    },
    "What Grace does": async ({ canvasElement }: Play) => {
      answered.mockClear();
      await expect(within(canvasElement).queryByRole("button", { name: "Not now" })).toBeNull();
      await tap(canvasElement, "Next");
      await expect(answered).toHaveBeenCalled();
    },
    Talk: async ({ canvasElement }: Play) => {
      talked.mockClear();
      await tap(canvasElement, "Talk");
      await expect(talked).toHaveBeenCalled();
    },
    Type: async ({ canvasElement }: Play) => {
      typed.mockClear();
      await tap(canvasElement, "Type");
      await expect(typed).toHaveBeenCalled();
    },
    Close: async ({ canvasElement }: Play) => {
      closed.mockClear();
      await tap(canvasElement, "Close");
      await expect(closed).toHaveBeenCalled();
    },
    "Save failed": async ({ canvasElement }: Play) => {
      answered.mockClear();
      await expect(within(canvasElement).queryByRole("button", { name: "Not now" })).toBeNull();
      await tap(canvasElement, "Retry");
      await expect(answered).toHaveBeenCalled();
    },
  },
};
