// spec/app/shell.md, "Story: Reach everyday tasks from Home"
import type { PluginListenerHandle } from "@capacitor/core";
import type {
  BrowserDockState,
  CreateSurfaceOptions,
  NavigateOptions,
  NativePageRead,
  PresentSurfaceOptions,
  ReconcileOwnerOptions,
  SetBoundsOptions,
  SetOcclusionRectsOptions,
  SurfaceIdOptions,
  SurfaceOwnerOptions,
  SurfaceState,
  SurfaceStateList,
} from "@elizaos/os/bridges/definitions/browser-surface";
import type { PasswordEntrySummary } from "@elizaos/os/bridges/definitions/passwords";
import type { ConnectOptions, WiFiNetwork, WiFiSecurity } from "@elizaos/os/bridges/definitions/wifi";
import { Effect, Stream } from "effect";
import { Machine as Workspaces } from "../gen/app__workspace.effect.vibe";
import type { EmbeddedAgent } from "./agentPlugin.ts";
import type { DevPagePreview, DevPageSection } from "./app.vibe";
import type { FileAttachment, FilesPort } from "./filesPlugin.ts";
import { ManagedReads } from "./managedReads.vibe";
import type { PasswordVault } from "./passwords.vibe";
import type { PreferenceDevice, PreferenceRecords, WifiSignIn } from "./preferencesPlugin.ts";
import type { SurfacePlugin, WiFiPlugin } from "./surfacePlugin.ts";
import type { Runtime } from "./useApp.ts";

const fallbackPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const samplePdfBase64 = btoa(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF\n",
);

function renderCardPng(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): string {
  if (typeof document === "undefined") return fallbackPngBase64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallbackPngBase64;
  paint(ctx, width, height);
  const dataUrl = canvas.toDataURL("image/png");
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : fallbackPngBase64;
}

function paintPhoto(
  skyTop: string,
  skyBottom: string,
  hill: string,
  accent: string,
  caption: string,
): string {
  return renderCardPng(640, 440, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, skyTop);
    grad.addColorStop(1, skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(w * 0.78, h * 0.24, 52, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hill;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.64);
    ctx.quadraticCurveTo(w * 0.3, h * 0.48, w * 0.62, h * 0.62);
    ctx.quadraticCurveTo(w * 0.85, h * 0.7, w, h * 0.56);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.88)";
    ctx.fillRect(28, h - 76, w - 56, 48);
    ctx.fillStyle = "#262235";
    ctx.font = "600 22px sans-serif";
    ctx.fillText(caption, 44, h - 44);
  });
}

function paintDocumentPage(title: string, subtitle: string, lines: readonly string[], pageNumber: number): string {
  return renderCardPng(760, 960, (ctx, w, h) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#3f3266";
    ctx.fillRect(0, 0, w, 12);

    ctx.fillStyle = "#262235";
    ctx.font = "700 32px sans-serif";
    ctx.fillText(title, 56, 84);
    ctx.fillStyle = "#5c5770";
    ctx.font = "500 20px sans-serif";
    ctx.fillText(subtitle, 56, 122);

    ctx.strokeStyle = "#e3dfee";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(56, 148);
    ctx.lineTo(w - 56, 148);
    ctx.stroke();

    ctx.fillStyle = "#262235";
    ctx.font = "400 22px sans-serif";
    let y = 204;
    for (const line of lines) {
      ctx.fillText(line, 56, y);
      y += 42;
    }

    ctx.fillStyle = "#7a748e";
    ctx.font = "500 18px sans-serif";
    ctx.fillText(`Page ${pageNumber}`, w - 124, h - 44);
  });
}

type StoredDevFile = {
  id: string;
  name: string;
  kind: "photo" | "pdf";
  savedAt: number;
  pages: number;
  from?: string;
  subject?: string;
  source?: FileAttachment["file"];
  version?: string;
  data: string;
  pagePreviews?: readonly string[];
};

function createDevFiles(): FilesPort {
  const now = Date.now();
  const day = 86_400_000;
  const leases = new Set<string>();
  const files: StoredDevFile[] = [
    {
      id: "11111111-1111-4111-8111-111111111101",
      name: "Garden Sunflowers.png",
      kind: "photo",
      savedAt: now - 3 * 3_600_000,
      pages: 0,
      from: "Susan Miller",
      subject: "Photos from the garden!",
      data: paintPhoto("#9ad0f5", "#f6e7c1", "#5a8f5c", "#f4c430", "Sunday afternoon sunflowers"),
    },
    {
      id: "11111111-1111-4111-8111-111111111102",
      name: "Patio Tea Table.png",
      kind: "photo",
      savedAt: now - 3 * 3_600_000 - 60_000,
      pages: 0,
      from: "Susan Miller",
      subject: "Photos from the garden!",
      data: paintPhoto("#b7d9f7", "#fde2c4", "#6e9e75", "#f7a072", "Lemon cake and iced tea on the patio"),
    },
    {
      id: "11111111-1111-4111-8111-111111111103",
      name: "Meadow Park Trail.png",
      kind: "photo",
      savedAt: now - 18 * day,
      pages: 0,
      from: "David Chen",
      subject: "Morning walk photos",
      data: paintPhoto("#a8d5e5", "#d9ed92", "#4f772d", "#ffd166", "Morning walk at Meadow Park"),
    },
    {
      id: "11111111-1111-4111-8111-111111111104",
      name: "Main St Clinic Visit Summary.pdf",
      kind: "pdf",
      savedAt: now - 2 * day,
      pages: 2,
      from: "Main St Clinic",
      subject: "Your visit summary and next appointment",
      data: samplePdfBase64,
      pagePreviews: [
        paintDocumentPage(
          "Main St Clinic — Visit Summary",
          "Provider: Dr. Asha Patel, MD · Suite 204",
          [
            "Blood pressure: 122 / 76 mmHg (within target range)",
            "Heart rate: 68 bpm, regular rhythm",
            "Current medications reviewed — no changes needed",
            "Continue daily 20–30 minute neighborhood walks",
            "Next appointment: Annual Checkup at Suite 204",
            "Questions? Call (555) 234-8910 Monday–Friday, 8 am–5 pm",
          ],
          1,
        ),
        paintDocumentPage(
          "Main St Clinic — Follow-up Checklist",
          "What to bring to your upcoming visit",
          [
            "1. Photo ID and insurance card",
            "2. Updated list of prescriptions and vitamins",
            "3. Any blood pressure readings noted at home",
            "4. Questions you would like to ask Dr. Patel",
            "Free patient parking is available behind the main entrance.",
          ],
          2,
        ),
      ],
    },
    {
      id: "11111111-1111-4111-8111-111111111105",
      name: "Riverside Book Club Reading List.pdf",
      kind: "pdf",
      savedAt: now - 14 * day,
      pages: 1,
      from: "Riverside Book Club",
      subject: "Autumn reading schedule",
      data: samplePdfBase64,
      pagePreviews: [
        paintDocumentPage(
          "Riverside Book Club — Reading List",
          "Meets Thursdays at 4:00 PM · Riverside Library, Room B",
          [
            "This week: Chapters 4–6 (tea and scones provided)",
            "Next month: The Light We Carry — Discussion led by Helen",
            "Large-print copies and audiobooks are held at the front desk",
            "Call the library desk at (555) 390-1122 for a ride share",
          ],
          1,
        ),
      ],
    },
  ];

  const requireLease = (lease: string) => {
    if (!leases.has(lease)) throw new Error("Unknown lease");
  };

  return {
    open: () => {
      const lease = crypto.randomUUID();
      leases.add(lease);
      return Promise.resolve({ lease });
    },
    close: ({ lease }) => {
      leases.delete(lease);
      return Promise.resolve();
    },
    list: ({ lease }) => {
      requireLease(lease);
      return Promise.resolve({
        entries: files.map(({ id, name, kind, savedAt, pages, from, subject, source, version }) => ({
          id,
          name,
          kind,
          savedAt,
          pages,
          ...(from ? { from } : {}),
          ...(subject ? { subject } : {}),
          ...(source ? { source } : {}),
          ...(version ? { version } : {}),
        })),
      });
    },
    preview: ({ lease, id, page }) => {
      requireLease(lease);
      const found = files.find((item) => item.id === id);
      if (!found) return Promise.reject(new Error("Missing file"));
      if (found.kind === "pdf") {
        const imageData = found.pagePreviews?.[page - 1] ?? paintDocumentPage(found.name, "Saved PDF document", ["Document preview"], Math.max(1, page));
        return Promise.resolve({ id, page, image: `data:image/png;base64,${imageData}` });
      }
      return Promise.resolve({ id, page, image: `data:image/png;base64,${found.data}` });
    },
    content: ({ lease, id }) => {
      requireLease(lease);
      const found = files.find((item) => item.id === id);
      if (!found) return Promise.reject(new Error("Missing file"));
      return Promise.resolve({
        id,
        mimeType: found.kind === "pdf" ? "application/pdf" : "image/png",
        data: found.data,
      });
    },
    saveAttachments: ({ lease, attachments }) => {
      requireLease(lease);
      const added: StoredDevFile[] = [];
      for (const attachment of attachments) {
        const existing = files.find((item) => item.source?.sourceRef === attachment.file.sourceRef);
        if (existing) {
          added.push(existing);
          continue;
        }
        const entry: StoredDevFile = {
          id: crypto.randomUUID(),
          name: attachment.file.name,
          kind: attachment.file.kind === "Pdf" ? "pdf" : "photo",
          savedAt: Date.now(),
          pages: attachment.file.pages,
          from: attachment.from || undefined,
          subject: attachment.subject || undefined,
          source: attachment.file,
          version: attachment.version,
          data: attachment.data,
        };
        files.unshift(entry);
        added.push(entry);
      }
      return Promise.resolve({
        entries: added.map(({ id, name, kind, savedAt, pages, from, subject, source, version }) => ({
          id,
          name,
          kind,
          savedAt,
          pages,
          ...(from ? { from } : {}),
          ...(subject ? { subject } : {}),
          ...(source ? { source } : {}),
          ...(version ? { version } : {}),
        })),
      });
    },
    remove: ({ lease, id }) => {
      requireLease(lease);
      const index = files.findIndex((item) => item.id === id);
      if (index >= 0) files.splice(index, 1);
      return Promise.resolve();
    },
  };
}

function wifiEntry(ssid: string, bssid: string, rssi: number, security: WiFiSecurity): WiFiNetwork {
  return {
    ssid,
    bssid,
    rssi,
    frequency: 5180,
    capabilities: security === "open" ? "[ESS]" : "[WPA2-PSK-CCMP][ESS]",
    secured: security !== "open" && security !== "owe",
    security,
  };
}

function createDevWifi(startOffline: boolean): { wifi: WiFiPlugin; wifiSignIn: WifiSignIn; isOnline: () => boolean } {
  const catalog: readonly WiFiNetwork[] = [
    wifiEntry("Home Network", "02:aa:bb:cc:dd:01", -44, "wpa2"),
    wifiEntry("Riverside Library Guest", "02:aa:bb:cc:dd:02", -58, "open"),
    wifiEntry("Sunrise Community Center", "02:aa:bb:cc:dd:03", -64, "wpa2"),
    wifiEntry("NETGEAR-4F2", "02:aa:bb:cc:dd:04", -68, "wpa2"),
    wifiEntry("Smith family", "02:aa:bb:cc:dd:05", -76, "wpa2"),
  ];
  let connectedSsid: string | null = startOffline ? null : "Home Network";
  const current = () => catalog.find((entry) => entry.ssid === connectedSsid) ?? null;

  const notify = () => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("android-network-changed"));
  };

  const wifi: WiFiPlugin = {
    checkPermissions: () => Promise.resolve({ location: "granted" }),
    requestPermissions: () => Promise.resolve({ location: "granted" }),
    getCapabilities: () => Promise.resolve({ sdk: 34, approvedJoin: true, internetPanel: true }),
    openInternetPanel: () => Promise.resolve(),
    getWifiState: () => {
      const active = current();
      return Promise.resolve({ enabled: true, connected: active !== null, rssi: active?.rssi ?? null });
    },
    getConnectedNetwork: () => Promise.resolve({ network: current() }),
    listAvailableNetworks: () => Promise.resolve({ networks: [...catalog] }),
    connectToNetwork: (options: ConnectOptions) => {
      connectedSsid = options.ssid;
      notify();
      return Promise.resolve({ success: true });
    },
    disconnectFromNetwork: () => {
      connectedSsid = null;
      notify();
      return Promise.resolve({ success: true });
    },
    getConnectivity: () => {
      const active = current();
      return Promise.resolve({
        online: active !== null,
        validated: active !== null,
        captivePortal: false,
        ssid: active?.ssid ?? null,
      });
    },
    addNetworkWithApproval: (options: ConnectOptions) => {
      if (options.password !== undefined && options.password.length < 8) {
        return Promise.reject(Object.assign(new Error("Password too short"), { code: "INVALID_ARGUMENT" }));
      }
      if (options.password === "wrongpass") return Promise.resolve({ status: "wrongPassword" });
      connectedSsid = options.ssid;
      notify();
      return Promise.resolve({ status: "connected" });
    },
  };

  const wifiSignIn: WifiSignIn = {
    getWifiSignIn: () => {
      const active = current();
      return Promise.resolve({
        required: false,
        validated: active !== null,
        access: active ? [{ ssid: active.ssid, bssid: active.bssid, secured: active.secured }] : [],
      });
    },
    openWifiSignIn: () => Promise.resolve(),
  };

  return { wifi, wifiSignIn, isOnline: () => connectedSsid !== null };
}

function describeDevPage(address: string): DevPagePreview {
  const parsed = URL.parse(address);
  const host = parsed?.hostname.replace(/^www\./, "") ?? address;

  if (parsed && host.includes("google.") && parsed.pathname === "/search") {
    const query = parsed.searchParams.get("q") ?? "Search";
    return {
      domain: host,
      title: `Search results for “${query}”`,
      summary: "Showing helpful pages matching your search in local preview mode.",
      sections: [
        {
          heading: "Riverside Public Library — Community Programs",
          body: "Large-print books, Thursday afternoon book club in Room B, and free technology help.",
          link: { label: "Open Riverside Book Club", url: "https://riversidebooks.org/schedule" },
        },
        {
          heading: "Main St Clinic — Patient Resources",
          body: "Office hours Monday through Friday 8 am to 5 pm. Suite 204 patient parking behind the lobby.",
          link: { label: "Open Main St Clinic", url: "https://mainstclinic.org" },
        },
        {
          heading: "Local Weather Forecast",
          body: "Partly sunny today, high near 68°F with light afternoon breeze.",
          link: { label: "Check weather", url: "https://weather.gov" },
        },
      ],
    };
  }

  if (host.includes("riversidebooks")) {
    return {
      domain: host,
      title: "Riverside Book Club",
      summary: "Thursday afternoons at 4:00 PM in Room B of the Riverside Public Library. Tea and scones served.",
      sections: [
        {
          heading: "This Thursday’s Discussion",
          body: "We are reading Chapters 4 through 6. Bring any favorite passages to share with the group.",
        },
        {
          heading: "Need a Large-Print Copy?",
          body: "Reserve copies are waiting behind the main desk under Riverside Book Club.",
          link: { label: "Check local weather before heading out", url: "https://weather.gov" },
        },
      ],
    };
  }

  if (host.includes("weather")) {
    return {
      domain: host,
      title: "Local Weather Forecast",
      summary: "Mild and sunny today — comfortable for an afternoon walk.",
      sections: [
        { heading: "Today", body: "Partly sunny · High 68°F · Low 52°F · Gentle breeze from the west." },
        { heading: "Tomorrow", body: "Clear skies · High 71°F · Low 54°F · Great weather for lunch on the patio." },
      ],
    };
  }

  if (host.includes("mainstclinic")) {
    return {
      domain: host,
      title: "Main St Clinic",
      summary: "Family medicine and preventive care · 410 Main Street, Suite 204.",
      sections: [
        { heading: "Office Hours", body: "Monday – Friday, 8:00 AM to 5:00 PM. Call (555) 234-8910 for appointments." },
        { heading: "Parking & Accessibility", body: "Step-free entrance and reserved patient spaces directly behind the clinic." },
      ],
    };
  }

  const sections: DevPageSection[] = [
    {
      heading: "Welcome",
      body: `You opened ${address}. In local browser development, Grace shows this readable page preview in place of Android’s native WebView.`,
    },
    {
      heading: "Try navigating to another page",
      body: "Use the address bar above, Back and Forward, or open one of these sample destinations.",
      link: { label: "Visit Riverside Book Club", url: "https://riversidebooks.org/schedule" },
    },
  ];
  return {
    domain: host,
    title: host.charAt(0).toUpperCase() + host.slice(1),
    summary: "Local preview page ready for browsing.",
    sections,
  };
}

type SurfaceRecord = {
  owner: string;
  session: string;
  epoch: number;
  history: string[];
  cursor: number;
  foregrounded: boolean;
  paused: boolean;
};

function createDevSurfacePlugin(isOnline: () => boolean): SurfacePlugin {
  const surfaces = new Map<string, SurfaceRecord>();
  const listeners = new Map<string, Set<(event: unknown) => void>>();

  const emit = (eventName: string, payload: Record<string, unknown>) => {
    void Promise.resolve().then(() => {
      const set = listeners.get(eventName);
      if (!set) return;
      for (const listener of set) listener(payload);
    });
  };

  const publishLoad = (id: string, record: SurfaceRecord) => {
    const url = record.history[record.cursor] ?? "";
    const base = { owner: record.owner, session: record.session, epoch: record.epoch, id };
    emit("pageStarted", { ...base, url });
    const online = isOnline();
    emit("navigationChanged", {
      ...base,
      exists: true,
      currentUrl: url,
      canGoBack: record.cursor > 0,
      canGoForward: record.cursor + 1 < record.history.length,
      progress: 100,
      pageError: online ? null : "ERR_INTERNET_DISCONNECTED",
      securityBlocked: false,
      title: describeDevPage(url).title,
    });
  };

  const registerListener = (eventName: string, listener: (event: unknown) => void): Promise<PluginListenerHandle> => {
    const existing = listeners.get(eventName) ?? new Set<(event: unknown) => void>();
    existing.add(listener);
    listeners.set(eventName, existing);
    return Promise.resolve({
      remove: () => {
        existing.delete(listener);
        return Promise.resolve();
      },
    });
  };

  const unsupportedDock = (): BrowserDockState => ({
    supported: false,
    embedded: false,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
  });

  const plugin: SurfacePlugin = {
    getBrowserHelperEntryState: () => Promise.resolve({ permissionGranted: false, visible: false, fullScreen: false }),
    requestBrowserHelperEntryPermission: () => Promise.resolve({ status: "dispatched" }),
    hideBrowserDockWithEntry: () => Promise.resolve({ status: "requested" }),
    restoreBrowserDockFromEntry: () => Promise.resolve({ status: "requested" }),
    setBrowserDockVisible: () => Promise.resolve({ status: "requested" }),
    openDockedBrowser: () => Promise.resolve({ packageName: "org.chromium.chrome", status: "dispatched" }),
    getBrowserDockState: () => Promise.resolve(unsupportedDock()),
    presentBrowser: () => Promise.resolve({ packageName: "org.chromium.chrome" }),
    openBrowser: () => Promise.resolve({ packageName: "org.chromium.chrome", engine: "chromium", surface: "custom-tab" }),
    createSurface: (options: CreateSurfaceOptions) => {
      const record: SurfaceRecord = {
        owner: options.owner,
        session: options.session,
        epoch: options.epoch,
        history: [options.url ?? ""],
        cursor: 0,
        foregrounded: false,
        paused: false,
      };
      surfaces.set(options.id, record);
      if (options.url) publishLoad(options.id, record);
      return Promise.resolve();
    },
    setBounds: (_options: SetBoundsOptions) => Promise.resolve(),
    setOcclusionRects: (_options: SetOcclusionRectsOptions) => Promise.resolve(),
    navigate: (options: NavigateOptions) => {
      const record = surfaces.get(options.id);
      if (record) {
        record.history = [...record.history.slice(0, record.cursor + 1), options.url];
        record.cursor = record.history.length - 1;
        publishLoad(options.id, record);
      }
      return Promise.resolve();
    },
    reloadSurface: (options: SurfaceIdOptions) => {
      const record = surfaces.get(options.id);
      if (record) publishLoad(options.id, record);
      return Promise.resolve();
    },
    stopLoading: (_options: SurfaceIdOptions) => Promise.resolve(),
    goBack: (options: SurfaceIdOptions) => {
      const record = surfaces.get(options.id);
      if (record && record.cursor > 0) {
        record.cursor -= 1;
        publishLoad(options.id, record);
      }
      return Promise.resolve();
    },
    goForward: (options: SurfaceIdOptions) => {
      const record = surfaces.get(options.id);
      if (record && record.cursor + 1 < record.history.length) {
        record.cursor += 1;
        publishLoad(options.id, record);
      }
      return Promise.resolve();
    },
    answerDialog: () => Promise.resolve(),
    answerFileChooser: () => Promise.resolve(),
    answerSitePermission: () => Promise.resolve({ granted: false, outcome: "denied" }),
    saveDownload: () => Promise.resolve(),
    openIdentityProvider: () => Promise.resolve({ status: "dispatched" }),
    openExternalLink: () => Promise.resolve({ status: "dispatched" }),
    purgeProfiles: () => {
      const count = surfaces.size;
      surfaces.clear();
      return Promise.resolve({ purged: count, clean: true });
    },
    observeHistory: () => Promise.resolve({ destinations: [] }),
    navigateHistory: () => Promise.resolve({
      documentId: "dev-doc-1",
      frameScope: "main",
      result: { dispatched: true, requiresReadback: true },
    }),
    controlPage: (options) => {
      const record = surfaces.get(options.id);
      const url = record ? record.history[record.cursor] ?? "" : "";
      if (options.command.subaction === "guide") {
        return Promise.resolve({ documentId: "dev-doc-1", frameScope: "main", result: { accepted: true } });
      }
      return Promise.resolve({
        documentId: "dev-doc-1",
        frameScope: "main",
        result: {
          snapshotId: "dev-snap-1",
          url,
          complete: true,
          readyState: "complete",
          title: describeDevPage(url).title,
          text: describeDevPage(url).summary,
          blockers: [],
          elements: [],
        },
      });
    },
    readPage: (options): Promise<NativePageRead> => {
      const record = surfaces.get(options.id);
      const url = record ? record.history[record.cursor] ?? "" : "";
      const preview = describeDevPage(url);
      return Promise.resolve({ url, title: preview.title, text: preview.summary, truncated: false });
    },
    addListener: ((eventName: string, listener: (event: unknown) => void) =>
      registerListener(eventName, listener)) as SurfacePlugin["addListener"],
    presentSurface: (options: PresentSurfaceOptions) => {
      for (const [id, record] of surfaces) record.foregrounded = id === options.id;
      return Promise.resolve();
    },
    pauseSurface: (options: SurfaceIdOptions) => {
      const record = surfaces.get(options.id);
      if (record) record.paused = true;
      return Promise.resolve();
    },
    resumeSurface: (options: SurfaceIdOptions) => {
      const record = surfaces.get(options.id);
      if (record) record.paused = false;
      return Promise.resolve();
    },
    destroySurface: (options: SurfaceIdOptions) => {
      surfaces.delete(options.id);
      return Promise.resolve();
    },
    getSurfaceState: (options: SurfaceIdOptions): Promise<SurfaceState> => {
      const record = surfaces.get(options.id);
      if (!record) {
        return Promise.resolve({
          exists: false,
          foregrounded: false,
          currentUrl: null,
          process: null,
          storage: null,
          owner: null,
          session: null,
          epoch: null,
        });
      }
      return Promise.resolve({
        exists: true,
        foregrounded: record.foregrounded,
        paused: record.paused,
        currentUrl: record.history[record.cursor] ?? null,
        process: "isolated",
        storage: "isolated",
        owner: record.owner,
        session: record.session,
        epoch: record.epoch,
        canGoBack: record.cursor > 0,
        canGoForward: record.cursor + 1 < record.history.length,
        progress: 100,
        pageError: null,
        securityBlocked: false,
      });
    },
    listSurfaceStates: (_options: SurfaceOwnerOptions): Promise<SurfaceStateList> => Promise.resolve({ surfaces: [] }),
    reconcileOwner: (_options: ReconcileOwnerOptions) => {
      surfaces.clear();
      return Promise.resolve();
    },
  };

  return plugin;
}

function buildDevReply(promptText: string) {
  const lower = promptText.toLowerCase();
  if (lower.includes("calendar") || lower.includes("appointment") || lower.includes("tomorrow") || lower.includes("schedule")) {
    return {
      text: "You have Dr. Patel — Annual Checkup coming up today at Main St Clinic, and Lunch with Susan tomorrow at 12:30 PM. Would you like me to open your calendar?",
      isQuestion: true,
      answers: ["Yes, open Calendar", "Check my email instead"],
      actions: [{ kind: "open", surface: "Calendar" }],
    };
  }
  if (lower.includes("email") || lower.includes("mail") || lower.includes("susan") || lower.includes("message")) {
    return {
      text: "You have new email from Susan Miller with garden photos and a visit summary from Main St Clinic. Would you like to open Email?",
      isQuestion: true,
      answers: ["Open Email", "Open saved Files"],
      actions: [{ kind: "open", surface: "Email" }],
    };
  }
  if (lower.includes("bigger") || lower.includes("larger") || lower.includes("text size") || lower.includes("font")) {
    return {
      text: "I can make the words on your screen larger right away, or open Text size settings so you can compare sizes.",
      isQuestion: true,
      answers: ["Make text larger", "Keep current size"],
      actions: [{ kind: "setTextSize", size: "Larger" }, { kind: "showSetting", page: "TextSizeSettings" }],
    };
  }
  if (lower.includes("wi-fi") || lower.includes("wifi") || lower.includes("internet") || lower.includes("connect")) {
    return {
      text: "I can take you straight to Wi-Fi settings to check your connection or pick another network.",
      isQuestion: true,
      answers: ["Open Wi-Fi settings", "Check my calendar"],
      actions: [{ kind: "showSetting", page: "NetworkSettings" }],
    };
  }
  if (lower.includes("file") || lower.includes("photo") || lower.includes("pdf") || lower.includes("picture")) {
    return {
      text: "Your saved garden photos and clinic visit summary are ready in Files. Would you like to open Files?",
      isQuestion: true,
      answers: ["Open Files", "Open Email"],
      actions: [{ kind: "open", surface: "Files" }],
    };
  }
  return {
    text: "I’m here to help with your email, calendar, photos, or websites. What would you like to do?",
    isQuestion: true,
    answers: ["Check my calendar", "Read my email", "Make text larger"],
    actions: [],
  };
}

function createDevAgent(): EmbeddedAgent {
  const listeners = new Map<string, Set<(input: unknown) => void>>();
  let conversationCount = 0;

  const emit = (event: "status" | "streamData" | "streamEnd", payload: unknown) => {
    void Promise.resolve().then(() => {
      const set = listeners.get(event);
      if (!set) return;
      for (const listener of set) listener(payload);
    });
  };

  return {
    getStatus: () => Promise.resolve({ state: "running" }),
    request: (input) => {
      if (input.path === "/api/conversations") {
        conversationCount += 1;
        return Promise.resolve({
          status: 200,
          data: {
            conversation: {
              id: `dev-conv-${conversationCount}`,
              roomId: `dev-room-${conversationCount}`,
            },
          },
        });
      }
      return Promise.resolve({ status: 200, data: {} });
    },
    requestStream: (input) => {
      const rawText = typeof input.body?.text === "string" ? input.body.text : "";
      const reply = buildDevReply(rawText);
      emit("streamData", { id: input.id, data: JSON.stringify({ type: "done", fullText: JSON.stringify(reply) }) });
      emit("streamEnd", { id: input.id, status: 200 });
      return Promise.resolve({ id: input.id });
    },
    abort: () => Promise.resolve({ aborted: true }),
    addListener: (event, listener) => {
      const existing = listeners.get(event) ?? new Set<(input: unknown) => void>();
      existing.add(listener);
      listeners.set(event, existing);
      return Promise.resolve({
        remove: () => {
          existing.delete(listener);
          return Promise.resolve();
        },
      });
    },
  };
}

function createDevVault(): PasswordVault {
  const now = Date.now();
  const entries: PasswordEntrySummary[] = [
    {
      id: "pw-clinic",
      label: "Main St Clinic Portal",
      username: "member.chen@gmail.com",
      bindings: [{ kind: "web", facet: "https://portal.mainstclinic.org", display: "portal.mainstclinic.org" }],
      updatedAt: now - 5 * 86_400_000,
      revision: 1,
    },
    {
      id: "pw-library",
      label: "Riverside Public Library",
      username: "card-294810",
      bindings: [{ kind: "web", facet: "https://riversidelibrary.org", display: "riversidelibrary.org" }],
      updatedAt: now - 12 * 86_400_000,
      revision: 1,
    },
    {
      id: "pw-pharmacy",
      label: "Oak Street Pharmacy",
      username: "member.chen@gmail.com",
      bindings: [{ kind: "web", facet: "https://oakstreetpharmacy.org", display: "oakstreetpharmacy.org" }],
      updatedAt: now - 20 * 86_400_000,
      revision: 1,
    },
    {
      id: "pw-power",
      label: "Pacific Valley Electric",
      username: "acct-88412",
      bindings: [{ kind: "web", facet: "https://pacificvalleyelectric.org", display: "pacificvalleyelectric.org" }],
      updatedAt: now - 35 * 86_400_000,
      revision: 1,
    },
  ];
  let nextId = 1;

  return {
    status: () => Promise.resolve({
      available: true,
      custody: "device-unlocked",
      locked: false,
      unlockRemainingMs: null,
      unlockSeconds: 300,
      biometric: false,
      autofill: { supported: true, selected: "this-app" },
    }),
    unlock: () => Promise.resolve({ unlockRemainingMs: null }),
    lock: () => Promise.resolve(),
    list: () => Promise.resolve(entries.map((entry) => ({ ...entry, bindings: [...entry.bindings] }))),
    openEditor: (input) => {
      if (input) {
        const found = entries.find((entry) => entry.id === input.entryId);
        if (!found) return Promise.resolve({ status: "cancelled" });
        found.revision += 1;
        found.updatedAt = Date.now();
        return Promise.resolve({ status: "saved", id: found.id, revision: found.revision });
      }
      const id = `pw-dev-${nextId++}`;
      entries.push({
        id,
        label: `New Website ${nextId}`,
        username: "member.chen@gmail.com",
        bindings: [{ kind: "web", facet: "https://example.org", display: "example.org" }],
        updatedAt: Date.now(),
        revision: 1,
      });
      return Promise.resolve({ status: "saved", id, revision: 1 });
    },
    remove: (id) => {
      const index = entries.findIndex((entry) => entry.id === id);
      if (index >= 0) entries.splice(index, 1);
      return Promise.resolve();
    },
    reveal: () => Promise.resolve({ hidesAfterMs: 15_000 }),
    copy: () => Promise.resolve({ clearsAfterMs: 30_000 }),
    openAutofillSettings: () => Promise.resolve({ destination: "autofill-picker" }),
  };
}

function createDevPreferences(): PreferenceRecords {
  const stored: { revision: number; value: string | null } = { revision: 0, value: null };
  return {
    read: () => Promise.resolve({ ...stored }),
    write: ({ revision, value }) => {
      if (revision !== stored.revision) return Promise.reject(new Error("Revision conflict"));
      stored.revision += 1;
      stored.value = value;
      return Promise.resolve({ revision: stored.revision });
    },
  };
}

function createDevDisplay(): PreferenceDevice {
  const volume = { step: 9, min: 0, max: 15, muted: false };
  const brightness = { percent: 100 };
  return {
    getDevice: () => Promise.resolve({ volume: { ...volume }, brightness: { ...brightness } }),
    setBrightness: ({ percent }) => {
      brightness.percent = percent;
      return Promise.resolve();
    },
    setVolume: ({ step, muted }) => {
      volume.step = step;
      volume.muted = muted;
      return Promise.resolve();
    },
    addListener: () => Promise.resolve({ remove: () => Promise.resolve() }),
  };
}

export function createDevFixture(search: string) {
  const params = new URLSearchParams(search);
  const offline = params.get("offline") === "1";
  const sleep = params.get("sleep") === "1";
  const { wifi, wifiSignIn, isOnline } = createDevWifi(offline);
  return {
    sleep,
    surface: createDevSurfacePlugin(isOnline),
    wifi,
    vault: createDevVault(),
    platform: {
      native: false,
      agent: createDevAgent(),
      files: createDevFiles(),
      preferences: createDevPreferences(),
      display: createDevDisplay(),
      wifiSignIn,
      pagePreview: describeDevPage,
    },
  };
}

export function maybeSleep(runtime: Runtime, sleep: boolean) {
  if (!sleep) return;
  void runtime.runPromise(
    Effect.flatMap(Effect.service(ManagedReads), (managed) =>
      Effect.ignore(Effect.timeout(Stream.runHead(Stream.filter(managed.home, (cards) => cards !== undefined)), "500 millis")),
    ).pipe(
      Effect.andThen(
        Effect.flatMap(Effect.service(Workspaces), (workspace) =>
          Effect.ignore(workspace.send({ type: "changeLifecycle", lifecycle: "SleepDevice" }, "Host")),
        ),
      ),
    ),
  );
}
