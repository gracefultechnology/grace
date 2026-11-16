import "../src/fonts.ts";
import "@repo/design-system/theme.css";

export default {
  globalTypes: { theme: { toolbar: { icon: "contrast", items: ["light", "dark"], dynamicTitle: true } } },
  initialGlobals: { theme: "light" },
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", selector: "*:not([data-prototype-ink])" }] } } },
  decorators: [
    (Story: () => unknown, context: { globals: { theme: string } }) => {
      document.documentElement.className = context.globals.theme;
      return Story();
    },
  ],
};
