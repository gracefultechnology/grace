import { useEffect, useImperativeHandle, useRef, useState, type ComponentProps, type KeyboardEvent, type Ref } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "../lib/cn.ts";
import { Button } from "./Button.tsx";

export type SecretFieldLabels = {
  placeholder: string;
  show: string;
  hide: string;
  showName: string;
  hideName: string;
  send: string;
};

export const secretFieldLabels: SecretFieldLabels = {
  placeholder: "Password",
  show: "Show",
  hide: "Hide",
  showName: "Show password",
  hideName: "Hide password",
  send: "Send",
};

/** How a form whose own button sends the secret asks the field for it. */
export type SecretFieldHandle = { submit: () => void };

export type SecretFieldProps = Omit<ComponentProps<"div">, "onSubmit"> & {
  /** The field's accessible name: "Password for Smith Family Wi-Fi". */
  label: string;
  /** Receives the secret once, by Send or Enter; the field clears at once. */
  onSubmit: (secret: string) => void;
  /** Called by Send with nothing typed. */
  onEmptySubmit?: () => void;
  autoFocus?: boolean;
  /** Words to replace, for another language; the rest keep their defaults. */
  labels?: Partial<SecretFieldLabels>;
  /** Shows Send beside the field. Without it the field is one of a form's: Enter submits the form, and the form's own button sends the secret through `handle`. */
  send?: boolean;
  /** Called with whether anything is typed, never with what. */
  onFilledChange?: (filled: boolean) => void;
  /** Receives `submit`, which sends the secret as Send does. */
  handle?: Ref<SecretFieldHandle>;
};

/**
 * The one place a secret is typed during set-up, in place of the answer field: masked, with Show or Hide inside it and
 * Send beside it. The value stays in the field, is never lifted or mirrored, and is cleared after Send and when the field
 * goes.
 * @design packages/design-system/design.md#grace
 */
export function SecretField({ label, onSubmit, onEmptySubmit, autoFocus, labels: words, send = true, onFilledChange, handle, className, ...props }: SecretFieldProps) {
  const labels = { ...secretFieldLabels, ...words };
  const inputRef = useRef<HTMLInputElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const field = inputRef.current;
    return () => {
      if (field) field.value = "";
    };
  }, []);
  const submit = () => {
    const field = inputRef.current;
    if (!field) return;
    const secret = field.value;
    if (!secret) return onEmptySubmit?.();
    field.value = "";
    onFilledChange?.(false);
    onSubmit(secret);
  };
  useImperativeHandle(handle, () => ({ submit }));
  const enter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  };
  return (
    <div className={cn("flex items-end gap-2 font-sans", className)} {...props}>
      <div className="flex h-16 min-w-0 flex-1 items-center gap-2 rounded-full bg-glass/62 pr-1 pl-6 shadow-capsule backdrop-blur-capsule backdrop-saturate-160">
        <input
          ref={inputRef}
          type={shown ? "text" : "password"}
          aria-label={label}
          placeholder={labels.placeholder}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint={send ? "send" : "go"}
          data-sensitive="true"
          autoFocus={autoFocus}
          onKeyDown={send ? enter : undefined}
          onInput={(event) => onFilledChange?.(event.currentTarget.value !== "")}
          className="m-0 h-8 min-w-0 flex-1 border-0 bg-transparent p-0 font-sans text-lead leading-8 font-medium text-grace-ink caret-primary outline-none placeholder:tracking-normal placeholder:text-placeholder placeholder:opacity-100 [&[type=password]]:tracking-[.2em]"
        />
        <Button
          variant="plain"
          size="compact"
          aria-label={shown ? labels.hideName : labels.showName}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => setShown((value) => !value)}
          className="px-5 text-grace-ink"
        >
          {shown ? labels.hide : labels.show}
        </Button>
      </div>
      {send && (
        <Button variant="prominent" size="pill" className="shadow-none" onClick={submit}>
          <ArrowUp size={24} strokeWidth={2.4} aria-hidden />
          {labels.send}
        </Button>
      )}
    </div>
  );
}
