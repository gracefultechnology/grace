import type { ReactNode } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import { cn } from "../lib/cn.ts";
import { AddressBar } from "./AddressBar.tsx";
import { BrowserPageState } from "./BrowserPageState.tsx";
import { BrowserTabStrip } from "./BrowserTabStrip.tsx";
import { BrowserToolbar } from "./BrowserToolbar.tsx";
import { BrowserWindow, type BrowserWindowProps } from "./BrowserWindow.tsx";
import { NewTabPage } from "./NewTabPage.tsx";
import { unfocus } from "./MailApp.meta.tsx";
import { onTablet } from "./SettingsApp.meta.tsx";

const closeBrowser = fn();
const newTab = fn();

const newTabWindow: BrowserWindowProps = {
  "aria-label": "Browser",
  tabStrip: <BrowserTabStrip tabs={[{ id: 1, title: "New tab" }]} selectedId={1} onNewTab={newTab} onCloseBrowser={closeBrowser} />,
  toolbar: (
    <BrowserToolbar>
      <AddressBar value="" />
    </BrowserToolbar>
  ),
  children: <NewTabPage />,
};

const payTab = [{ id: 1, title: "Pay your card · Chase", initial: "C" }];

const tablet = (children: ReactNode) => onTablet(() => children);

export const onBrowser = (story: () => ReactNode, site = "chase.com/pay") =>
  tablet(
    <>
      <BrowserWindow
        aria-label="Browser"
        tabStrip={<BrowserTabStrip tabs={payTab} selectedId={1} />}
        toolbar={
          <BrowserToolbar canGoBack canGo reloadable onReload={() => {}}>
            <AddressBar value={site} />
          </BrowserToolbar>
        }
      />
      {story()}
    </>,
  );

const pages = {
  signin: { title: "Sign in · Chase", url: "chase.com", bar: "Chase" },
  account: { title: "Credit card · Chase", url: "chase.com/card", bar: "Credit card ••7731" },
  pay: { title: "Pay your card · Chase", url: "chase.com/pay", bar: "Credit card ••7731" },
  review: { title: "Review payment · Chase", url: "chase.com/pay/review", bar: "Credit card ••7731" },
  done: { title: "Payment scheduled · Chase", url: "chase.com/pay/done", bar: "Credit card ••7731" },
};
const amounts = { statement: "$84.20", minimum: "$35.00" };
type Site = { password?: string; amount?: keyof typeof amounts; date?: string; error?: string; focus?: "username" | "password" | "date" };

const siteButton = "h-12 cursor-pointer rounded-tag border-0 bg-site-brand px-7 font-site text-label font-bold text-glass";

const SiteLabel = ({ children }: { children: ReactNode }) => <label className="mt-3.5 mb-1.5 block text-base/[normal] text-site-muted">{children}</label>;

const SiteRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between border-b border-site-line py-2 text-label">
    <span className="text-site-muted">{label}</span>
    <b>{value}</b>
  </div>
);

const SiteField = ({ value = "", placeholder, focused = false, masked = false }: { value?: string; placeholder: string; focused?: boolean; masked?: boolean }) => (
  <div
    role="textbox"
    aria-label={placeholder}
    tabIndex={0}
    className={cn(
      "box-border flex h-[46px] w-full cursor-text items-center rounded-tag border border-site-border bg-glass px-3 text-lg/[normal] text-site-ink",
      focused && "border-site-brand shadow-site-focus",
    )}
  >
    {(masked ? "•".repeat(value.length) : value) || (focused ? "" : (
      <span data-prototype-ink="" className="text-site-placeholder">
        {placeholder}
      </span>
    ))}
    {focused && <span className="ml-0.5 inline-block h-[22px] w-0.5 animate-blink bg-site-brand motion-reduce:animate-none" />}
  </div>
);

const SiteError = ({ children }: { children?: string }) => (children ? <div className="mt-2.5 text-base/[normal] text-site-error">{children}</div> : null);

const chase = (page: keyof typeof pages, site: Site = {}): Partial<BrowserWindowProps> => {
  const amount = site.amount ? amounts[site.amount] : "not chosen";
  const card = "absolute top-[92px] left-10 box-border w-[560px] rounded-sm bg-glass px-6 py-5 shadow-site-card";
  return {
    tabStrip: <BrowserTabStrip tabs={[{ id: 1, title: pages[page].title, initial: "C" }]} selectedId={1} />,
    toolbar: (
      <BrowserToolbar canGoBack canGo>
        <AddressBar value={pages[page].url} />
      </BrowserToolbar>
    ),
    children: (
      <div className="absolute inset-0 overflow-y-auto bg-site font-site leading-[normal] text-site-ink">
        <div className="box-border flex h-16 items-center justify-between bg-site-brand px-10 text-body-lg font-bold text-glass">
          {pages[page].bar}
          <span className="text-caption font-normal opacity-85">Website mock · not a real page</span>
        </div>
        {page === "signin" && (
          <div className={cn(card, "w-[460px]")}>
            <div className="text-lead font-bold">Welcome back</div>
            <SiteLabel>Username</SiteLabel>
            <SiteField value="margaret.h" placeholder="Username" focused={site.focus === "username"} />
            <SiteLabel>Password</SiteLabel>
            <SiteField value={site.password} placeholder="Password" focused={site.focus === "password"} masked />
            <SiteError>{site.error}</SiteError>
            <div className="mt-5">
              <button type="button" className={siteButton}>
                Sign in
              </button>
            </div>
          </div>
        )}
        {page === "account" && (
          <>
            <div className={card}>
              <SiteRow label="Statement balance" value="$84.20" />
              <SiteRow label="Minimum payment due" value="$35.00" />
              <SiteRow label="Payment due date" value="Nov 12, 2026" />
              <SiteRow label="Current balance" value="$112.55" />
              <div className="pt-2.5 text-base/[normal] text-site-muted">No payment scheduled</div>
            </div>
            <button type="button" className={cn(siteButton, "absolute top-[330px] left-10")}>
              Pay card
            </button>
          </>
        )}
        {page === "pay" && (
          <div className={cn(card, "top-[84px] w-[520px]")}>
            <div className="text-body-lg font-bold">Pay your card</div>
            <SiteLabel>Pay from</SiteLabel>
            <div className="box-border flex h-[46px] w-full cursor-default items-center rounded-tag border border-site-border bg-glass px-3 text-lg/[normal]">Checking ••4821</div>
            <SiteLabel>Amount</SiteLabel>
            <div>
              {(
                [
                  ["statement", "Statement balance $84.20"],
                  ["minimum", "Minimum payment $35.00"],
                ] as const
              ).map(([key, label]) => (
                <div
                  key={key}
                  role="radio"
                  aria-checked={site.amount === key}
                  tabIndex={0}
                  className="mt-1.5 flex cursor-pointer items-center gap-2.5 rounded-tag border border-site-border bg-glass px-3 py-2.5 text-label"
                >
                  <i className={cn("box-border size-[18px] flex-none rounded-full border-2 border-site-muted", site.amount === key && "border-[6px] border-site-brand")} />
                  {label}
                </div>
              ))}
            </div>
            <SiteLabel>Payment date</SiteLabel>
            <SiteField value={site.date} placeholder="MM/DD/YYYY" focused={site.focus === "date"} />
            <SiteError>{site.error}</SiteError>
            <div className="mt-5">
              <button type="button" className={siteButton}>
                Continue
              </button>
            </div>
          </div>
        )}
        {page === "review" && (
          <>
            <div className={cn(card, "top-[84px]")}>
              <div className="mb-1.5 text-body-lg font-bold">Review your payment</div>
              <SiteRow label="Pay to" value="Card ••7731" />
              <SiteRow label="Pay from" value="Checking ••4821" />
              <SiteRow label="Amount" value={amount} />
              <SiteRow label="Date" value={site.date ?? ""} />
              <SiteRow label="Fee" value="$0.00" />
            </div>
            <div className="absolute top-[372px] left-10 flex items-center gap-4">
              <button type="button" className={siteButton}>
                Submit payment
              </button>
              <button type="button" className={cn(siteButton, "bg-glass text-site-brand inset-ring inset-ring-site-brand")}>
                Edit
              </button>
            </div>
          </>
        )}
        {page === "done" && (
          <div className={cn(card, "top-[84px]")}>
            <div className="text-lead font-bold text-site-ok">Payment scheduled</div>
            <p className="my-[18px] text-lg/[26px]">
              Thanks. Your payment of {amount} to card ••7731 is scheduled for {site.date}.
            </p>
            <div className="inline-block text-lg/[normal]">
              Confirmation <b>4F7K-22Q</b>
            </div>
          </div>
        )}
      </div>
    ),
  };
};

export const meta: ComponentMeta<BrowserWindowProps> = {
  args: newTabWindow,
  examples: {
    "Website: sign in": chase("signin", { focus: "password" }),
    "Website: sign-in error": chase("signin", { error: "Enter your password." }),
    "Website: account": chase("account"),
    "Website: pay": chase("pay", { amount: "statement", date: "11/12/2026" }),
    "Website: review": chase("review", { amount: "statement", date: "11/12/2026" }),
    "Website: payment scheduled": chase("done", { amount: "statement", date: "11/12/2026" }),
    "Grace typing": {
      toolbar: (
        <BrowserToolbar canGo>
          <AddressBar value="chase.com" guided />
        </BrowserToolbar>
      ),
    },
    "Empty Go": {
      toolbar: (
        <BrowserToolbar>
          <AddressBar value="" notice="Type a website or what you’re looking for." />
        </BrowserToolbar>
      ),
    },
    "Loading with more tabs": {
      tabStrip: (
        <BrowserTabStrip
          tabs={[{ id: 1, title: "Sign in · Chase", initial: "C" }, { id: 3, title: "Review payment · Chase", initial: "C", pageLoading: true }, { id: 5, title: "New tab" }]}
          overflow={[{ id: 2, title: "Credit card · Chase", initial: "C" }, { id: 4, title: "Payment scheduled · Chase", initial: "C" }]}
          selectedId={3}
        />
      ),
      toolbar: (
        <BrowserToolbar canGoBack canGo reloadable pageLoading onStop={() => {}}>
          <AddressBar value="chase.com/pay/review" />
        </BrowserToolbar>
      ),
      children: <BrowserPageState kind="checking" site="chase.com" />,
    },
    "Page failed": {
      tabStrip: <BrowserTabStrip tabs={[{ id: 1, title: "chase.com", initial: "C" }]} selectedId={1} />,
      toolbar: (
        <BrowserToolbar canGo reloadable onReload={() => {}}>
          <AddressBar value="chase.com" />
        </BrowserToolbar>
      ),
      children: <BrowserPageState kind="failed" site="chase.com" message="The website took too long to answer." onRetry={() => {}} />,
    },
  },
  decorator: (story) => tablet(story() as ReactNode),
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const canvas = within(canvasElement);
      await expect(canvas.getByRole("button", { name: "Back" })).toBeDisabled();
      await userEvent.click(canvas.getByRole("button", { name: "Open a new tab" }));
      await userEvent.click(canvas.getByRole("button", { name: "Close browser" }));
      await expect([newTab, closeBrowser].map((f) => f.mock.calls.length)).toEqual([1, 1]);
      unfocus();
    },
  },
};
