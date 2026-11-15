import type { ComponentType, SVGProps } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Calendar, CalendarCheck, Camera, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, CircleCheck, CircleHelp, CircleSlash, CircleUserRound, CircleX, Clock, Download,
  ExternalLink, Eye, FilePen, FileText, FileUp, FolderOpen, Forward, Globe, Image, Inbox, Info, Keyboard, ListChecks,
  Lock, LogIn, LogOut, Mail, MapPin, Maximize2, MessageSquare, MessageSquarePlus, MessageSquareText, Mic, Minimize2,
  Minus, Pause, Phone, Plus, ReceiptText, RefreshCw, Reply, RotateCcw, RotateCw, Search, Shield, ShieldAlert,
  ShieldCheck, ShoppingBag, SwitchCamera, TriangleAlert, Undo2, Wifi, X, Zap, ZapOff,
} from "lucide-react";
import * as own from "./icons.tsx";

// The prototype draws its icons as axi() does: 24px, stroke 2.2, in the current color.
export default { title: "Foundations/Icons", parameters: { layout: "fullscreen" } };

// The Lucide icons the components import (src/components, `from "lucide-react"`).
const lucide = {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Calendar, CalendarCheck, Camera, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleAlert, CircleCheck, CircleHelp, CircleSlash, CircleUserRound, CircleX, Clock, Download,
  ExternalLink, Eye, FilePen, FileText, FileUp, FolderOpen, Forward, Globe, Image, Inbox, Info, Keyboard, ListChecks,
  Lock, LogIn, LogOut, Mail, MapPin, Maximize2, MessageSquare, MessageSquarePlus, MessageSquareText, Mic, Minimize2,
  Minus, Pause, Phone, Plus, ReceiptText, RefreshCw, Reply, RotateCcw, RotateCw, Search, Shield, ShieldAlert,
  ShieldCheck, ShoppingBag, SwitchCamera, TriangleAlert, Undo2, Wifi, X, Zap, ZapOff,
};

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

const Sheet = ({ icons }: { icons: Record<string, Icon> }) => (
  <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-3 bg-background p-8 font-sans text-grace-ink">
    {Object.entries(icons).map(([name, Glyph]) => (
      <figure key={name} className="m-0 flex flex-col items-center gap-3 rounded-tile bg-panel px-2 py-5">
        <Glyph aria-hidden width={24} height={24} strokeWidth={2.2} className="size-6" />
        <figcaption className="text-sm leading-5 break-all text-muted-foreground">{name}</figcaption>
      </figure>
    ))}
  </div>
);

/** The prototype's own drawings (src/icons.tsx). */
export const Own = () => <Sheet icons={Object.fromEntries(Object.entries(own).filter(([, value]) => typeof value === "function")) as Record<string, Icon>} />;

/** The Lucide set the components use. */
export const Lucide = () => <Sheet icons={lucide} />;
