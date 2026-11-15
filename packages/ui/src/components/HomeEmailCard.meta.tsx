import type { ComponentMeta } from "vibestack/stories";
import { susan } from "./Avatar.meta.tsx";
import type { HomeEmailCardProps } from "./HomeEmailCard.tsx";

// The clinic's white cross (prototype `av('clinic')`).
const cross = (
  <svg aria-hidden width="30" height="30" viewBox="0 0 24 24">
    <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor" />
  </svg>
);

// Prototype `homeCards()`: the two unread emails in the inbox.
export const email: HomeEmailCardProps = {
  status: "2 new",
  messages: [
    { id: "susan", name: "Susan", src: susan, subject: "Photos from Lily’s recital", unread: true },
    { id: "clinic", name: "Main St Clinic", tone: 1, icon: cross, subject: "Reminder: your appointment tomorrow at 10 am", unread: true },
  ],
};

export const meta: ComponentMeta<HomeEmailCardProps> = {
  args: email,
  states: {
    Offline: { ...email, status: "Waiting for the internet", waiting: "New email will arrive when you’re back online." },
    Empty: { ...email, status: "No new email", messages: [] },
  },
  // The card's glass needs Home's wash behind it; 470×290 as on Home.
  decorator: (story) => (
    <div className="bg-gradient-frame-soft p-12">
      <div className="h-[290px] w-[470px] *:size-full">{story()}</div>
    </div>
  ),
};
