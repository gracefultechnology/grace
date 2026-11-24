import { useRef, useState, type ComponentProps, type FormEvent } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { Label } from "./Label.tsx";
import { PageText } from "./PageHeading.tsx";
import { emailProviders, type EmailProvider } from "./ProviderGrid.tsx";
import { SecretField, type SecretFieldHandle } from "./SecretField.tsx";
import { TextField } from "./TextField.tsx";

/** Why the last Next did not connect: the address is at a listed company, or the company refused the password. */
export type OtherEmailProblem = { kind: "listedProvider"; provider: Exclude<EmailProvider, "other"> } | { kind: "passwordRefused" };

/** What Next hands up, once: the password goes straight on to the email company and is never kept or shown. */
export type OtherEmailDetails = { name: string; address: string; password: string };

const problemText = (problem: OtherEmailProblem) => {
  switch (problem.kind) {
    case "listedProvider": {
      const { name: company, article } = emailProviders[problem.provider];
      return `This is ${article} ${company} address. Go back and choose ${company}, so you can sign in on ${company}’s own page.`;
    }
    case "passwordRefused":
      return "That password didn’t work. Check it and try again. Some email companies give you a special password for apps; Grace can explain.";
    default: {
      const _exhaustive: never = problem;
      return _exhaustive;
    }
  }
};

export type OtherEmailFormProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  /** The name people see on her emails, to start with. */
  defaultName?: string;
  /** The address, to start with, as when signing in again. */
  defaultAddress?: string;
  /** Why the last Next did not connect, above the fields. */
  problem?: OtherEmailProblem;
  /** The email company is checking what she typed: Next waits. */
  checking?: boolean;
  /** Called by Next once a name, a whole address and a password are typed; the password field empties at once. Without it Next stays disabled. */
  onNext?: (details: OtherEmailDetails) => void;
  /** Whether Next may go on with the address as typed, trimmed; Next stays disabled while it refuses. */
  accepts?: (address: string) => boolean;
  onCancel?: () => void;
};

/**
 * Settings' page for an email at a company that is not listed: her name, the address and its password, which goes only
 * to that company (prototype `accPage()` on `other`). The window's title is Other email.
 * @model spec/app/accounts.md
 * @design packages/design-system/design.md#windows
 */
export function OtherEmailForm({ defaultName = "", defaultAddress = "", problem, checking = false, onNext, accepts = () => true, onCancel, className, ...props }: OtherEmailFormProps) {
  const [typedName, setTypedName] = useState<string>();
  const name = typedName ?? defaultName;
  const [address, setAddress] = useState(defaultAddress);
  const [filled, setFilled] = useState(false);
  const secretRef = useRef<SecretFieldHandle>(null);
  const ready = name.trim() !== "" && /@.+\./.test(address) && accepts(address.trim()) && filled && !checking && onNext !== undefined;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ready) secretRef.current?.submit();
  };
  return (
    <form aria-label="Other email" noValidate onSubmit={submit} className={cn("font-sans", className)} {...props}>
      <PageText tone="secondary">For email from your internet company, work, or anywhere else. Grace won’t see what you type.</PageText>
      {problem ? (
        <Alert variant="caution" icon={<TriangleAlert size={26} strokeWidth={2.2} />} className="mt-4 max-w-[620px]">
          {problemText(problem)}
        </Alert>
      ) : null}
      <TextField label="Your name" placeholder="Your name" value={name} onChange={(event) => setTypedName(event.target.value)} autoComplete="off" className="mt-3.5 max-w-[620px]" />
      <PageText tone="secondary" className="mt-1.5 ml-1.5">This is the name people see on your emails.</PageText>
      <TextField
        label="Email address"
        type="email"
        inputMode="email"
        placeholder="For example: margaret@riverview.net"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        autoComplete="off"
        autoCapitalize="none"
        className="mt-3.5 max-w-[620px]"
      />
      <Label className="mt-3.5 max-w-[620px] flex-col items-stretch gap-2">
        <span className="pl-[26px]">Password</span>
        <SecretField
          label="Password"
          send={false}
          handle={secretRef}
          onFilledChange={setFilled}
          onSubmit={(password) => onNext?.({ name: name.trim(), address: address.trim(), password })}
          labels={{ placeholder: "Your email password" }}
        />
      </Label>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" variant="prominent" size="pill" loading={checking} disabled={!ready}>
          {checking ? "Checking…" : "Next"}
        </Button>
        {onCancel && <Button variant="capsule" size="pill" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
