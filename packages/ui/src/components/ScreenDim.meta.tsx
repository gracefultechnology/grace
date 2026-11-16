import type { ComponentMeta } from "vibestack/stories";
import { HomeScreen, type HomeScreenProps } from "./HomeScreen.tsx";
import { meta as home } from "./HomeScreen.meta.tsx";
import type { ScreenDimProps } from "./ScreenDim.tsx";

export const meta: ComponentMeta<ScreenDimProps> = {
  args: { brightness: 40 },
  bounds: { brightness: [20, 100] },
  decorator: (story) => home.decorator?.(() => (
    <>
      <HomeScreen {...(home.args as HomeScreenProps)} />
      {story()}
    </>
  )),
};
