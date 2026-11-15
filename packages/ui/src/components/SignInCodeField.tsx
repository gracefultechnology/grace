import { TextField, type TextFieldProps } from "./TextField.tsx";

export type SignInCodeFieldProps = Omit<TextFieldProps, "value" | "onChange" | "type" | "inputMode" | "pattern"> & {
  /** The digits typed so far. */
  value: string;
  /** Called with the digits only, as they are typed or pasted. */
  onValueChange?: (code: string) => void;
  /** How many digits the code has. */
  length?: number;
};

/**
 * The six-digit code an account sends by email or text (senior-care NativeCloudSignIn.tsx, SignInCodeField): a labelled
 * field that keeps only digits and offers the code the phone received. The code stays in this form, out of the chat.
 * @design packages/design-system/design.md#buttons
 */
export function SignInCodeField({ value, onValueChange, length = 6, ...props }: SignInCodeFieldProps) {
  return (
    <TextField
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern={`[0-9]{${length}}`}
      minLength={length}
      maxLength={length}
      required
      value={value}
      onChange={(event) => onValueChange?.(event.target.value.replace(/\D/g, ""))}
      {...props}
    />
  );
}
