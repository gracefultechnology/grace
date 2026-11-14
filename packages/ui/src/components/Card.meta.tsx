import type { ComponentMeta } from "vibestack/stories";
import { Button } from "./Button.tsx";
import { CardFooter, type CardProps, CardTitle } from "./Card.tsx";
import { Progress } from "./Progress.tsx";

export const meta: ComponentMeta<CardProps> = {
  args: {
    className: "w-[520px]",
    children: (
      <>
        <CardTitle>Visit form</CardTitle>
        <Progress value={2} max={3} aria-label="Pages read" />
        <CardFooter>
          <Button variant="prominent" size="pill">Open</Button>
        </CardFooter>
      </>
    ),
  },
  decorator: (story) => <div className="bg-gradient-frame p-6">{story()}</div>,
};
