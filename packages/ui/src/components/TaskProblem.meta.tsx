import { fn } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { Button } from "./Button.tsx";
import type { TaskProblemProps } from "./TaskProblem.tsx";

const answers = (way: string) => (
  <>
    <Button variant="prominent" size="pill" onClick={fn()}>{way}</Button>
    <Button variant="capsule" size="pill" onClick={fn()}>Pause</Button>
  </>
);

export const meta: ComponentMeta<TaskProblemProps> = {
  args: {
    text: "The Gmail account connected now isn’t the one you confirmed, so I didn’t look for the code.",
    question: "Shall we check which Gmail account is connected? Or you can type the code yourself.",
    actions: answers("Check the Gmail account"),
  },
  decorator: (story) => <div className="w-[760px] bg-background p-6">{story()}</div>,
  examples: {
    "Reconnect Gmail": {
      text: "Gmail needs to be connected again, so I couldn’t look for the code in your email.",
      question: "Shall we reconnect Gmail? Or you can type the code from your email yourself.",
      actions: answers("Reconnect Gmail"),
    },
    "Wrong account": {
      text: "This website is signed in to a different account from the one on the bill.",
      question: "Shall we check the website again once you’ve signed in to the right account?",
      actions: answers("Check website again"),
    },
    "Sign-in unavailable": {
      text: "The website’s sign-in isn’t working right now, so I can’t get to the bill.",
      question: "Shall we try again later?",
      actions: answers("Check website again"),
    },
    "Payment not allowed": {
      text: "The website won’t take a payment for this bill online.",
      question: "You can pay it another way, or open the website to look yourself.",
      actions: answers("Open website"),
    },
    "Booking needs a deposit": {
      text: "Main St Clinic asks for a deposit to book online, so I didn’t book it.",
      question: "You can call the clinic, or open the website to look yourself.",
      actions: answers("Open website"),
    },
    "Words only": { actions: undefined, question: "Please sign in again from Settings, or type the code from your email yourself.", text: "You need to sign in to your account again before I can look in Gmail. Gmail itself is fine." },
  },
};
