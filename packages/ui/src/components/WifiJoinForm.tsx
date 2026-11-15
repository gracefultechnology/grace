import { useId, type ComponentProps, type FormEvent, type ReactNode } from "react";
import { TriangleAlert, Wifi } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Alert } from "./Alert.tsx";
import { Button } from "./Button.tsx";
import { Input } from "./Input.tsx";
import { Label } from "./Label.tsx";
import { PageText } from "./PageHeading.tsx";
import { SettingsPageHeading } from "./SettingsPageHeading.tsx";
import { TextField } from "./TextField.tsx";

export type WifiJoinFormProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  /** The network being joined. */
  network: string;
  /** The network asks for a person's own account name as well as a password. */
  account?: boolean;
  /** The account name typed so far. */
  user?: string;
  onUserChange?: (user: string) => void;
  /** The password typed so far; it stays in the tablet and is never shown to Grace. */
  password?: string;
  onPasswordChange?: (password: string) => void;
  /** The password shows as text. */
  showPassword?: boolean;
  onShowPasswordChange?: (show: boolean) => void;
  /** Why the last try failed, announced as an alert above the fields. */
  error?: ReactNode;
  /** Called by Join, once what the network asks for is typed. */
  onJoin?: () => void;
  onCancel?: () => void;
  /** Shows "Ask Grace to help", after a second failed try (prototype `W.err>=2`). */
  askGrace?: boolean;
  /** Called by "Ask Grace to help". */
  onAskGrace?: () => void;
  /** The page's title. */
  title?: string;
  /** What the network needs, under the title. */
  description?: ReactNode;
  userLabel?: string;
  /** An example account name, such as the person's own: "For example: margaret". */
  userPlaceholder?: string;
  passwordLabel?: string;
  passwordPlaceholder?: string;
  showLabel?: string;
  hideLabel?: string;
  joinLabel?: string;
  cancelLabel?: string;
  askGraceLabel?: string;
};

/**
 * Settings' page for joining a locked network: its password (and account name, where the network asks for one),
 * with Show, Join and Cancel (prototype `wifiPage()` with `X.wifi.join`).
 * @model spec/app/network.md
 * @design packages/design-system/design.md#windows
 */
export function WifiJoinForm({
  network,
  account = false,
  user = "",
  onUserChange,
  password = "",
  onPasswordChange,
  showPassword = false,
  onShowPasswordChange,
  error,
  onJoin,
  onCancel,
  askGrace = false,
  onAskGrace,
  title = `Join ${network}`,
  description = account
    ? "This network needs your own account name and password, the ones the center gave you. Grace won’t see what you type."
    : "This network needs a password. At home, it’s usually on a sticker on the internet box. Grace won’t see what you type.",
  userLabel = "Account name",
  userPlaceholder,
  passwordLabel = "Password",
  passwordPlaceholder = "Type the password",
  showLabel = "Show",
  hideLabel = "Hide",
  joinLabel = "Join",
  cancelLabel = "Cancel",
  askGraceLabel = "Ask Grace to help",
  className,
  ...props
}: WifiJoinFormProps) {
  const passwordId = useId();
  const ready = password !== "" && (!account || user !== "");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (ready) onJoin?.();
  };
  return (
    <form aria-label={title} onSubmit={submit} className={cn("font-sans", className)} {...props}>
      <SettingsPageHeading>{title}</SettingsPageHeading>
      <PageText tone="secondary" className="mt-1.5">{description}</PageText>
      {error ? (
        // Prototype `axi('alert',26,2.2)`, and max-width 760px plus its padding (content-box).
        <Alert variant="caution" icon={<TriangleAlert size={26} strokeWidth={2.2} />} className="mt-[18px] max-w-[800px]">
          {error}
        </Alert>
      ) : null}
      {account && (
        <TextField
          label={userLabel}
          value={user}
          onChange={(event) => onUserChange?.(event.target.value)}
          placeholder={userPlaceholder}
          autoComplete="off"
          className="mt-5 max-w-[620px]"
        />
      )}
      {/* Prototype `.a-fld` with Show beside the capsule. */}
      <div className={cn("flex max-w-[620px] flex-col gap-2", account ? "mt-3.5" : "mt-5")}>
        <Label htmlFor={passwordId} className="pl-[26px]">{passwordLabel}</Label>
        <div className="flex items-center gap-2.5">
          <Input
            id={passwordId}
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => onPasswordChange?.(event.target.value)}
            placeholder={passwordPlaceholder}
            autoComplete="off"
            invalid={!!error}
            className="h-16 flex-1"
          />
          <Button variant="capsule" size="pill" className="pr-[26px] pl-[22px]" onClick={() => onShowPasswordChange?.(!showPassword)}>
            {showPassword ? hideLabel : showLabel}
          </Button>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button type="submit" variant="prominent" size="pill" className="pr-[26px] pl-[22px]" disabled={!ready}>
          <Wifi size={22} strokeWidth={2.2} aria-hidden />
          {joinLabel}
        </Button>
        <Button variant="capsule" size="pill" className="pr-[26px] pl-[22px]" onClick={onCancel}>
          {cancelLabel}
        </Button>
        {askGrace && (
          <Button variant="capsule" size="pill" className="pr-[26px] pl-[22px]" onClick={onAskGrace}>
            {askGraceLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
