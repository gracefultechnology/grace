import { expect, fn, userEvent, within } from "storybook/test";
import type { ComponentMeta } from "vibestack/stories";
import type { SecretFieldProps } from "./SecretField.tsx";

const submit = fn();
const empty = fn();

export const meta: ComponentMeta<SecretFieldProps> = {
  args: { label: "Password for Smith Family Wi-Fi", onSubmit: submit, onEmptySubmit: empty },
  decorator: (story) => (
    <div className="group/grace w-[1130px] bg-background p-4">
      {story()}
    </div>
  ),
  examples: {
    Spanish: {
      label: "Contraseña de Smith Family Wi-Fi",
      labels: { placeholder: "Contraseña", show: "Mostrar", hide: "Ocultar", showName: "Mostrar contraseña", hideName: "Ocultar contraseña", send: "Enviar" },
    },
  },
  play: {
    Default: async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      submit.mockClear();
      empty.mockClear();
      const canvas = within(canvasElement);
      const field = canvas.getByLabelText("Password for Smith Family Wi-Fi");
      await userEvent.click(canvas.getByRole("button", { name: "Send" }));
      await expect(empty).toHaveBeenCalled();
      await userEvent.type(field, "garden42");
      await expect(field).toHaveAttribute("type", "password");
      await userEvent.click(canvas.getByRole("button", { name: "Show password" }));
      await expect(field).toHaveAttribute("type", "text");
      await userEvent.click(canvas.getByRole("button", { name: "Send" }));
      await expect(submit).toHaveBeenCalledWith("garden42");
      await expect(field).toHaveValue("");
    },
  },
};
