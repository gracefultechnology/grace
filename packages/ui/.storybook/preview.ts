import "../src/fonts.ts";
import "@repo/design-system/theme.css";

/** The toolbar's theme switch sets the class the tokens' dark values hang on. */
export default {
  globalTypes: { theme: { toolbar: { icon: "contrast", items: ["light", "dark"], dynamicTitle: true } } },
  initialGlobals: { theme: "light" },
  // The user chose the prototype's exact pale inks (Grace's unspoken words, days outside the month, the week's Today) over
  // AA contrast; axe skips only text marked `data-prototype-ink`, and checks every other contrast.
  parameters: { a11y: { config: { rules: [{ id: "color-contrast", selector: "*:not([data-prototype-ink])" }] } } },
  decorators: [
    (Story: () => unknown, context: { globals: { theme: string } }) => {
      document.documentElement.className = context.globals.theme;
      return Story();
    },
  ],
};
