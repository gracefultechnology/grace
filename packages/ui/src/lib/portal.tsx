import { createContext, use, type ReactNode } from "react";

const PortalContainerContext = createContext<HTMLElement | null | undefined>(undefined);

export type PortalContainerProviderProps = {
  container?: HTMLElement | null;
  children: ReactNode;
};

export function PortalContainerProvider({ container, children }: PortalContainerProviderProps) {
  return <PortalContainerContext value={container}>{children}</PortalContainerContext>;
}

export function usePortalContainer() {
  return use(PortalContainerContext);
}
