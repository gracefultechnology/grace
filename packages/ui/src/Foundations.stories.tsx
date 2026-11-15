import type { CSSProperties, ReactNode } from "react";
import tokens from "@repo/design-system/tokens.json" with { type: "json" };

// Every value below is read from the design tokens (packages/design-system/tokens.json) through their CSS variables. Tailwind
// emits a theme variable only where a class uses it, so each falls back to the token's own value; colors use their base variables.
export default { title: "Foundations/Tokens", parameters: { layout: "fullscreen" } };

const Section = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6 bg-background p-8 font-sans text-foreground">{children}</div>;
const Name = ({ name, value }: { name: string; value: string }) => (
  <div className="mt-2 text-sm leading-5">
    <div className="font-bold">{name}</div>
    <div className="break-all text-muted-foreground">{value}</div>
  </div>
);
const tile = "h-24 rounded-row bg-card";
const keys = <T extends object>(scale: T) => Object.entries(scale) as [string, string][];

export const Colors = () => (
  <Section>
    {keys(tokens.color.light).map(([name, value]) => (
      <div key={name}>
        <div className="h-20 rounded-row shadow-hairline" style={{ background: `var(--${name})` }} />
        <Name name={name} value={value} />
      </div>
    ))}
  </Section>
);

export const Type = () => (
  <div className="flex flex-col gap-5 bg-background p-8 font-sans text-foreground">
    {keys(tokens.text).map(([name, value]) => (
      <div key={name} className="flex items-baseline gap-6">
        <span className="w-36 flex-none text-sm text-muted-foreground">
          {name} · {value}
        </span>
        <span className="font-bold" style={{ fontSize: `var(--text-${name}, ${value})` }}>
          Good morning, Margaret
        </span>
      </div>
    ))}
  </div>
);

export const Radii = () => (
  <Section>
    {keys(tokens.rounded).map(([name, value]) => (
      <div key={name}>
        <div className="h-24 bg-primary/12" style={{ borderRadius: `var(--radius-${name}, ${value})` }} />
        <Name name={name} value={value} />
      </div>
    ))}
  </Section>
);

export const Shadows = () => (
  <Section>
    {keys(tokens.shadow).map(([name, value]) => (
      <div key={name}>
        <div className={tile} style={{ boxShadow: `var(--shadow-${name}, ${value})` }} />
        <Name name={name} value={value} />
      </div>
    ))}
    {keys(tokens.dropShadow).map(([name, value]) => (
      <div key={`drop-${name}`}>
        <div className={tile} style={{ filter: `drop-shadow(var(--drop-shadow-${name}, ${value}))` }} />
        <Name name={`drop-${name}`} value={value} />
      </div>
    ))}
  </Section>
);

// Glass over the frame, the only place blur shows.
export const Blurs = () => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-6 bg-gradient-frame p-8 font-sans text-foreground">
    {keys(tokens.blur).map(([name, value]) => (
      <div key={name} className="relative">
        <div className="absolute top-6 left-6 size-12 rounded-full bg-primary" />
        <div className="relative h-24 rounded-row bg-glass/10 shadow-glass" style={{ backdropFilter: `blur(var(--blur-${name}, ${value}))` }} />
        <Name name={name} value={value} />
      </div>
    ))}
  </div>
);

export const Gradients = () => (
  <Section>
    {keys(tokens.gradient).map(([name]) => (
      <div key={name}>
        <div className="h-24 rounded-row" style={{ backgroundImage: `var(--gradient-${name})` }} />
        <Name name={name} value={`bg-gradient-${name}`} />
      </div>
    ))}
  </Section>
);

// Hover a row: its dot crosses with that duration or ease (eases run over the window duration).
const Run = ({ name, value, style }: { name: string; value: string; style: CSSProperties }) => (
  <div className="group flex items-center gap-6">
    <span className="w-56 flex-none text-sm">
      <b>{name}</b> <span className="text-muted-foreground">{value}</span>
    </span>
    <div className="relative h-8 flex-1 rounded-full bg-panel">
      <span className="absolute top-1 left-1 size-6 rounded-full bg-primary group-hover:translate-x-[400px]" style={{ transitionProperty: "transform", ...style }} />
    </div>
  </div>
);

export const Motion = () => (
  <div className="flex flex-col gap-4 bg-background p-8 font-sans text-foreground">
    {keys(tokens.motion.duration).map(([name, value]) => (
      <Run key={name} name={`duration-${name}`} value={value} style={{ transitionDuration: `var(--transition-duration-${name}, ${value})`, transitionTimingFunction: "var(--ease-standard)" }} />
    ))}
    {keys(tokens.motion.ease).map(([name, value]) => (
      <Run key={name} name={`ease-${name}`} value={value} style={{ transitionDuration: "var(--transition-duration-window)", transitionTimingFunction: `var(--ease-${name}, ${value})` }} />
    ))}
  </div>
);

export const Animations = () => (
  <Section>
    {keys(tokens.animate).map(([name, value]) => (
      <div key={name}>
        <div className="flex h-24 items-center justify-center rounded-row bg-panel">
          <span className="size-10 rounded-full bg-primary" style={{ animation: `var(--animate-${name}, ${value})` }} />
        </div>
        <Name name={name} value={value} />
      </div>
    ))}
  </Section>
);
