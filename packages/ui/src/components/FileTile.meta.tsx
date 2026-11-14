import type { ComponentMeta } from "vibestack/stories";
import { photos } from "./FilesApp.meta.tsx";
import type { FileTileProps } from "./FileTile.tsx";

export const meta: ComponentMeta<FileTileProps> = {
  args: { src: photos.flowers, label: "Photo 2" },
  decorator: (story) => <div className="w-[256px] bg-background p-6">{story()}</div>,
};
