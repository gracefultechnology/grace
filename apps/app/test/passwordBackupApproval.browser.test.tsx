import { expect, it, onTestFinished, vi } from "vitest";
import { pendingPasswordApproval } from "../src/passwordBackupConsent.vibe";

it('Open only a registered backup request (spec/app/setup.md, "Browser approval needs an explicit choice for the shown account")', async () => {
  const original = location.href;
  const approval = {
    clientId: "technology.graceful.grace", environment: "staging", purpose: "save",
    redirectUri: location.origin + "/android/auth/callback", state: "s".repeat(43),
    codeChallenge: "c".repeat(43), codeChallengeMethod: "S256",
  };
  const account = { id: "owner", email: null };
  const network = window.fetch.bind(window);
  const session = vi.spyOn(window, "fetch").mockImplementation((input, init) =>
    typeof input === "string" && new URL(input, location.href).pathname === "/api/auth/session"
      ? Promise.resolve(Response.json({ account })) : network(input, init));
  onTestFinished(() => {
    session.mockRestore();
    history.replaceState(null, "", original);
  });
  const open = (request: Record<string, string>) => {
    history.replaceState(null, "", "/android/passwords/approve#" + new URLSearchParams(request).toString());
    return pendingPasswordApproval();
  };

  expect(await open({ ...approval, recoveryKey: "k".repeat(43) })).toEqual({ present: true, approval: null, account: null });
  expect(await open({ ...approval, password: "p" })).toEqual({ present: true, approval: null, account: null });
  expect(await open(approval)).toEqual({ present: true, approval, account });
});
