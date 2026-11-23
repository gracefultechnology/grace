import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { deflateSync } from "node:zlib";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import vibelang from "vibelang-vite";
import { defaultClientConditions, defineConfig, type Plugin } from "vite";

const ACCOUNT_ID = "dev-member-1";
const ACCOUNT_EMAIL = "margaret.chen@gmail.com";
const GRANT_ID = "dev-google-grant-1";
const ORG_ID = "dev-org-1";

function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 1) !== 0 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const tag = Buffer.from(type, "ascii");
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([tag, data])), 0);
  return Buffer.concat([length, tag, data, checksum]);
}

function makePngBytes(width: number, height: number, topRgb: readonly [number, number, number], bottomRgb: readonly [number, number, number]): Buffer {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    raw[rowStart] = 0;
    const t = height > 1 ? y / (height - 1) : 0;
    const r = Math.round(topRgb[0] + (bottomRgb[0] - topRgb[0]) * t);
    const g = Math.round(topRgb[1] + (bottomRgb[1] - topRgb[1]) * t);
    const b = Math.round(topRgb[2] + (bottomRgb[2] - topRgb[2]) * t);
    for (let x = 0; x < width; x++) {
      const offset = rowStart + 1 + x * 3;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function makePdfBytes(heading: string, detail: string): Buffer {
  const safe = (text: string) => text.replace(/[()\\]/g, "");
  const stream = `BT /F1 18 Tf 54 730 Td (${safe(heading)}) Tj 0 -30 Td /F1 12 Tf (${safe(detail)}) Tj ET`;
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += obj;
  }
  const xrefStart = Buffer.byteLength(body, "utf8");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body + xref + trailer, "utf8");
}

type DevAttachment = {
  partId: string;
  name: string;
  mimeType: "image/png" | "application/pdf";
  bytes: Buffer;
};

type DevMail = {
  externalId: string;
  folder: "inbox" | "sent" | "drafts" | "trash";
  previousFolder?: "inbox" | "sent" | "drafts";
  from: string;
  fromEmail: string;
  subject: string;
  receivedAt: string;
  isUnread: boolean;
  labels: string[];
  historyId: string;
  snippet: string;
  bodyText: string;
  reply: { recipient: string; subject: string } | null;
  attachments: DevAttachment[];
};

type DevEvent = {
  externalId: string;
  etag: string;
  editable: boolean;
  seriesId: string | null;
  timezone: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  isAllDay: boolean;
};

function relativeHour(daysAhead: number, hour: number, minute: number): Date {
  const base = new Date();
  const target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + daysAhead, hour, minute, 0, 0);
  if (daysAhead === 0 && target.getTime() <= base.getTime() + 15 * 60_000) {
    return new Date(base.getTime() + 90 * 60_000);
  }
  return target;
}

function createDevStore() {
  const now = Date.now();
  const hour = 3_600_000;
  const day = 86_400_000;
  let signedIn = true;
  let googleConnected = true;
  let historyCounter = 10050;
  const sentOperations = new Map<string, string>();
  const ownerScope = sha256Hex(JSON.stringify(["grace/files/owner", ACCOUNT_ID, ORG_ID]));
  const sessionScope = sha256Hex("dev-files-session-1");

  const sunflowersPng = makePngBytes(96, 72, [135, 206, 250], [244, 196, 48]);
  const patioPng = makePngBytes(96, 72, [183, 217, 247], [110, 158, 117]);
  const clinicPdf = makePdfBytes(
    "Main St Clinic - Visit Summary",
    "Dr. Asha Patel, Suite 204. Blood pressure 122/76. Next visit confirmed.",
  );

  const messages: DevMail[] = [
    {
      externalId: "msg-susan-photos",
      folder: "inbox",
      from: "Susan Miller",
      fromEmail: "susan.miller@gmail.com",
      subject: "Photos from the garden!",
      receivedAt: new Date(now - 2 * hour).toISOString(),
      isUnread: true,
      labels: ["INBOX", "UNREAD"],
      historyId: "10041",
      snippet: "Here are the photos from Sunday afternoon on the patio...",
      bodyText:
        "Hi Margaret,\n\nHere are the photos from Sunday afternoon! The sunflowers finally opened right next to the patio table.\n\nLooking forward to lunch tomorrow at Oak Street Bistro.\n\nLove,\nSusan",
      reply: { recipient: "susan.miller@gmail.com", subject: "Re: Photos from the garden!" },
      attachments: [
        { partId: "1", name: "sunflowers.png", mimeType: "image/png", bytes: sunflowersPng },
        { partId: "2", name: "patio-tea.png", mimeType: "image/png", bytes: patioPng },
      ],
    },
    {
      externalId: "msg-clinic-summary",
      folder: "inbox",
      from: "Main St Clinic",
      fromEmail: "records@mainstclinic.org",
      subject: "Your visit summary and next appointment",
      receivedAt: new Date(now - 1 * day).toISOString(),
      isUnread: true,
      labels: ["INBOX", "UNREAD"],
      historyId: "10042",
      snippet: "Your visit summary from Dr. Patel is attached as a PDF...",
      bodyText:
        "Dear Margaret Chen,\n\nThank you for visiting Main St Clinic. Your visit summary from Dr. Asha Patel is attached as a PDF for your records.\n\nReminder: please bring your medication list and insurance card to your upcoming checkup in Suite 204.\n\nMain St Clinic Patient Support\n(555) 234-8910",
      reply: { recipient: "records@mainstclinic.org", subject: "Re: Your visit summary and next appointment" },
      attachments: [
        { partId: "1", name: "visit-summary.pdf", mimeType: "application/pdf", bytes: clinicPdf },
      ],
    },
    {
      externalId: "msg-book-club",
      folder: "inbox",
      from: "Riverside Book Club",
      fromEmail: "hello@riversidebooks.org",
      subject: "Thursday tea & chapters 4–6",
      receivedAt: new Date(now - 2 * day).toISOString(),
      isUnread: false,
      labels: ["INBOX"],
      historyId: "10043",
      snippet: "We are meeting Thursday at 4:00 PM in Room B at the library...",
      bodyText:
        "Hello readers,\n\nWe are meeting Thursday at 4:00 PM in Room B at Riverside Public Library to talk about chapters 4 through 6. Tea and lemon scones will be ready!\n\nFull reading schedule: https://riversidebooks.org/schedule\n\nWarmly,\nHelen & Riverside Book Club",
      reply: { recipient: "hello@riversidebooks.org", subject: "Re: Thursday tea & chapters 4–6" },
      attachments: [],
    },
    {
      externalId: "msg-security-scam",
      folder: "inbox",
      from: "Account Security",
      fromEmail: "alert@verify-account-now.example",
      subject: "URGENT: Your account will be closed today",
      receivedAt: new Date(now - 3 * day).toISOString(),
      isUnread: true,
      labels: ["INBOX", "SPAM", "UNREAD"],
      historyId: "10044",
      snippet: "Immediate verification required or your access will be suspended...",
      bodyText:
        "URGENT NOTICE:\n\nYour account has been flagged and will be closed in 2 hours unless you confirm your password immediately at https://verify-account-now.example/confirm\n\nAct now to avoid losing access.",
      reply: null,
      attachments: [],
    },
    {
      externalId: "msg-sent-dinner",
      folder: "sent",
      from: "Margaret Chen",
      fromEmail: ACCOUNT_EMAIL,
      subject: "Re: Sunday dinner",
      receivedAt: new Date(now - 4 * day).toISOString(),
      isUnread: false,
      labels: ["SENT"],
      historyId: "10045",
      snippet: "Count me in for Sunday! I will bring the apple pie.",
      bodyText: "Hi Susan,\n\nCount me in for Sunday! I will bring the apple pie.\n\nSee you then,\nMargaret",
      reply: null,
      attachments: [],
    },
  ];

  const todayCheckup = relativeHour(0, 14, 0);
  const tomorrowLunch = relativeHour(1, 12, 30);
  const bookClubStart = relativeHour(2, 16, 0);
  const walkStart = relativeHour(4, 9, 30);

  const events: DevEvent[] = [
    {
      externalId: "evt-dr-patel",
      etag: "etag-patel-1",
      editable: true,
      seriesId: null,
      timezone: "America/Los_Angeles",
      title: "Dr. Patel — Annual Checkup",
      description: "Bring medication list and insurance card. Free parking behind main entrance.",
      location: "Main St Clinic, Suite 204",
      startAt: todayCheckup.toISOString(),
      endAt: new Date(todayCheckup.getTime() + 45 * 60_000).toISOString(),
      isAllDay: false,
    },
    {
      externalId: "evt-lunch-susan",
      etag: "etag-susan-1",
      editable: true,
      seriesId: null,
      timezone: "America/Los_Angeles",
      title: "Lunch with Susan",
      description: "Catch up over soup and look at the new garden photos.",
      location: "Oak Street Bistro",
      startAt: tomorrowLunch.toISOString(),
      endAt: new Date(tomorrowLunch.getTime() + 90 * 60_000).toISOString(),
      isAllDay: false,
    },
    {
      externalId: "evt-book-club",
      etag: "etag-bookclub-1",
      editable: true,
      seriesId: "series-book-club",
      timezone: "America/Los_Angeles",
      title: "Riverside Book Club",
      description: "Discussing chapters 4–6 over tea and scones.",
      location: "Riverside Library, Room B",
      startAt: bookClubStart.toISOString(),
      endAt: new Date(bookClubStart.getTime() + 90 * 60_000).toISOString(),
      isAllDay: false,
    },
    {
      externalId: "evt-morning-walk",
      etag: "etag-walk-1",
      editable: true,
      seriesId: null,
      timezone: "America/Los_Angeles",
      title: "Morning Walk with Neighbors",
      description: "Easy 30-minute loop around Meadow Park.",
      location: "Meadow Park Entrance",
      startAt: walkStart.toISOString(),
      endAt: new Date(walkStart.getTime() + 45 * 60_000).toISOString(),
      isAllDay: false,
    },
  ];

  const seriesMaster: DevEvent = {
    externalId: "series-book-club",
    etag: "etag-bookclub-series-1",
    editable: true,
    seriesId: null,
    timezone: "America/Los_Angeles",
    title: "Riverside Book Club",
    description: "Weekly book discussion over tea and scones.",
    location: "Riverside Library, Room B",
    startAt: bookClubStart.toISOString(),
    endAt: new Date(bookClubStart.getTime() + 90 * 60_000).toISOString(),
    isAllDay: false,
  };

  return {
    get signedIn() {
      return signedIn;
    },
    set signedIn(value: boolean) {
      signedIn = value;
    },
    get googleConnected() {
      return googleConnected;
    },
    set googleConnected(value: boolean) {
      googleConnected = value;
    },
    nextHistory() {
      historyCounter += 1;
      return String(historyCounter);
    },
    ownerScope,
    sessionScope,
    messages,
    events,
    seriesMaster,
    sentOperations,
  };
}

type DevStore = ReturnType<typeof createDevStore>;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) {
        resolve({});
        return;
      }
      try {
        const parsed: unknown = JSON.parse(text);
        resolve(typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function mailRow(message: DevMail) {
  return {
    externalId: message.externalId,
    from: message.from,
    fromEmail: message.fromEmail,
    subject: message.subject,
    receivedAt: message.receivedAt,
    isUnread: message.isUnread,
    labels: [...message.labels],
    metadata: { historyId: message.historyId },
  };
}

function handleMailEndpoints(store: DevStore, method: string, path: string, url: URL, body: Record<string, unknown>, res: ServerResponse): boolean {
  if (method === "GET" && path === "/api/v1/eliza/google/gmail/triage") {
    const folderParam = url.searchParams.get("folder") ?? "inbox";
    const folder = folderParam === "sent" || folderParam === "drafts" || folderParam === "trash" ? folderParam : "inbox";
    const q = (url.searchParams.get("q") ?? "").trim();
    const needle = q.toLowerCase();
    const rows = store.messages
      .filter((message) => message.folder === folder)
      .filter((message) => !needle || message.from.toLowerCase().includes(needle) || message.subject.toLowerCase().includes(needle) || message.bodyText.toLowerCase().includes(needle))
      .map(mailRow);
    const inboxUnread = store.messages.filter((message) => message.folder === "inbox" && message.isUnread).length;
    const drafts = store.messages.filter((message) => message.folder === "drafts").length;
    sendJson(res, 200, {
      accountId: ACCOUNT_ID,
      folder,
      q,
      messages: rows,
      nextPageToken: null,
      counts: { inboxUnread, drafts },
    });
    return true;
  }

  if (method === "GET" && path === "/api/v1/eliza/google/gmail/read") {
    const messageId = url.searchParams.get("messageId") ?? "";
    const found = store.messages.find((message) => message.externalId === messageId);
    if (!found) {
      sendJson(res, 404, { error: "not_found" });
      return true;
    }
    sendJson(res, 200, {
      accountId: ACCOUNT_ID,
      message: { ...mailRow(found), snippet: found.snippet },
      historyId: found.historyId,
      attachments: found.attachments.map((part) => ({
        partId: part.partId,
        name: part.name,
        mimeType: part.mimeType,
        size: part.bytes.length,
        supported: true,
      })),
      reply: found.reply,
      bodyText: found.bodyText,
      bodyTextAvailable: true,
    });
    return true;
  }

  if (method === "GET" && path === "/api/v1/eliza/google/gmail/attachment") {
    const messageId = url.searchParams.get("messageId") ?? "";
    const partId = url.searchParams.get("partId") ?? "";
    const grantId = url.searchParams.get("grantId") ?? GRANT_ID;
    const found = store.messages.find((message) => message.externalId === messageId);
    const part = found?.attachments.find((entry) => entry.partId === partId);
    if (!found || !part) {
      sendJson(res, 404, { error: "not_found" });
      return true;
    }
    sendJson(res, 200, {
      version: 1,
      accountId: ACCOUNT_ID,
      messageId: found.externalId,
      historyId: found.historyId,
      partId: part.partId,
      name: part.name,
      mimeType: part.mimeType,
      size: part.bytes.length,
      supported: true,
      grantId,
      organizationId: ORG_ID,
      dataBase64: part.bytes.toString("base64"),
      sha256: sha256Hex(part.bytes),
    });
    return true;
  }

  if (method === "POST" && path === "/api/v1/eliza/google/gmail/trash") {
    const messageId = typeof body.messageId === "string" ? body.messageId : "";
    const operationId = typeof body.operationId === "string" ? body.operationId : "op-trash";
    const isUndo = typeof body.undoOf === "string" && body.undoOf.length > 0;
    const found = store.messages.find((message) => message.externalId === messageId);
    if (!found) {
      sendJson(res, 404, { error: "not_found" });
      return true;
    }
    if (isUndo) {
      found.folder = found.previousFolder ?? "inbox";
      found.labels = found.labels.filter((label) => label !== "TRASH");
      if (!found.labels.includes("INBOX") && found.folder === "inbox") found.labels.push("INBOX");
    } else {
      if (found.folder !== "trash") found.previousFolder = found.folder;
      found.folder = "trash";
      found.labels = [...found.labels.filter((label) => label !== "INBOX"), "TRASH"];
    }
    found.historyId = store.nextHistory();
    sendJson(res, 200, {
      accountId: ACCOUNT_ID,
      operationId,
      itemId: found.externalId,
      version: found.historyId,
    });
    return true;
  }

  if (method === "POST" && path === "/api/v1/eliza/google/gmail/send") {
    const operationId = typeof body.operationId === "string" ? body.operationId : "op-send";
    const recipient = typeof body.recipient === "string" ? body.recipient : "";
    const subject = typeof body.subject === "string" ? body.subject : "";
    const text = typeof body.text === "string" ? body.text : "";
    const messageId = `msg-sent-${Date.now()}`;
    store.sentOperations.set(operationId, messageId);
    store.messages.unshift({
      externalId: messageId,
      folder: "sent",
      from: "Margaret Chen",
      fromEmail: ACCOUNT_EMAIL,
      subject: subject || `To ${recipient}`,
      receivedAt: new Date().toISOString(),
      isUnread: false,
      labels: ["SENT"],
      historyId: store.nextHistory(),
      snippet: text.slice(0, 80),
      bodyText: text,
      reply: null,
      attachments: [],
    });
    sendJson(res, 200, { accountId: ACCOUNT_ID, operationId, messageId });
    return true;
  }

  if (method === "GET" && path === "/api/v1/eliza/google/gmail/send/status") {
    const operationId = url.searchParams.get("operationId") ?? "";
    const messageId = store.sentOperations.get(operationId);
    if (!messageId) {
      sendJson(res, 404, { error: "not_found" });
      return true;
    }
    sendJson(res, 200, { accountId: ACCOUNT_ID, operationId, messageId });
    return true;
  }

  if (method === "GET" && path === "/api/v1/eliza/google/gmail/inbox-v1/arrival") {
    sendJson(res, 200, { cursor: "dev-arrival-cursor-1", arrived: false });
    return true;
  }

  return false;
}

function handleCalendarEndpoints(store: DevStore, method: string, path: string, url: URL, body: Record<string, unknown>, res: ServerResponse): boolean {
  if (method === "GET" && path === "/api/v1/eliza/google/calendar/feed") {
    const timeMin = Date.parse(url.searchParams.get("timeMin") ?? "");
    const timeMax = Date.parse(url.searchParams.get("timeMax") ?? "");
    const filtered = store.events.filter((event) => {
      const start = Date.parse(event.startAt);
      const end = Date.parse(event.endAt);
      if (Number.isFinite(timeMin) && end < timeMin) return false;
      if (Number.isFinite(timeMax) && start > timeMax) return false;
      return true;
    });
    sendJson(res, 200, { accountId: ACCOUNT_ID, events: filtered, nextPageToken: null });
    return true;
  }

  if (method === "GET" && path === "/api/v1/eliza/google/calendar/series") {
    const occurrenceId = url.searchParams.get("occurrenceId") ?? "";
    sendJson(res, 200, { accountId: ACCOUNT_ID, occurrenceId, event: store.seriesMaster });
    return true;
  }

  if (method === "GET" && path === "/api/v1/eliza/google/calendar/reminder/event") {
    const occurrenceId = url.searchParams.get("occurrenceId") ?? "";
    const found = store.events.find((event) => event.externalId === occurrenceId) ?? store.events[0];
    if (!found) {
      sendJson(res, 404, { error: "not_found" });
      return true;
    }
    sendJson(res, 200, { accountId: ACCOUNT_ID, event: found });
    return true;
  }

  if (method === "POST" && path === "/api/v1/eliza/google/calendar/change") {
    const action = typeof body.action === "string" ? body.action : "";
    const operationId = typeof body.operationId === "string" ? body.operationId : "op-cal";
    const eventInput = typeof body.event === "object" && body.event !== null ? (body.event as Record<string, unknown>) : undefined;
    if (action === "create" && eventInput) {
      const itemId = operationId.replaceAll("-", "");
      const etag = `etag-${store.nextHistory()}`;
      store.events.push({
        externalId: itemId,
        etag,
        editable: true,
        seriesId: null,
        timezone: "America/Los_Angeles",
        title: typeof eventInput.title === "string" ? eventInput.title : "New appointment",
        description: "",
        location: typeof eventInput.location === "string" ? eventInput.location : "",
        startAt: typeof eventInput.startAt === "string" ? eventInput.startAt : new Date().toISOString(),
        endAt: typeof eventInput.endAt === "string" ? eventInput.endAt : new Date(Date.now() + 3_600_000).toISOString(),
        isAllDay: eventInput.allDay === true,
      });
      sendJson(res, 200, { accountId: ACCOUNT_ID, operationId, itemId, version: etag });
      return true;
    }
    const id = typeof body.id === "string" ? body.id : "";
    if (action === "update" && eventInput) {
      const target = store.events.find((event) => event.externalId === id) ?? (id === store.seriesMaster.externalId ? store.seriesMaster : undefined);
      if (target) {
        if (typeof eventInput.title === "string") target.title = eventInput.title;
        if (typeof eventInput.location === "string") target.location = eventInput.location;
        if (typeof eventInput.startAt === "string") target.startAt = eventInput.startAt;
        if (typeof eventInput.endAt === "string") target.endAt = eventInput.endAt;
        target.etag = `etag-${store.nextHistory()}`;
        sendJson(res, 200, { accountId: ACCOUNT_ID, operationId, itemId: id, version: target.etag });
        return true;
      }
    }
    if (action === "delete") {
      const index = store.events.findIndex((event) => event.externalId === id || event.seriesId === id);
      if (index >= 0) store.events.splice(index, 1);
      sendJson(res, 200, { accountId: ACCOUNT_ID, operationId, itemId: id, version: `etag-${store.nextHistory()}` });
      return true;
    }
    sendJson(res, 400, { error: "invalid_change" });
    return true;
  }

  if (method === "POST" && path === "/api/v1/eliza/google/calendar/reminder") {
    const occurrenceId = typeof body.occurrenceId === "string" ? body.occurrenceId : "";
    const version = typeof body.version === "string" ? body.version : "";
    const minutes = typeof body.minutes === "number" ? body.minutes : 0;
    const found = store.events.find((event) => event.externalId === occurrenceId);
    if (!found) {
      sendJson(res, 404, { error: "not_found" });
      return true;
    }
    sendJson(res, 200, {
      accountId: ACCOUNT_ID,
      grantId: GRANT_ID,
      occurrenceId,
      version,
      status: minutes === 0 ? "cancelled" : "saved",
      ...(minutes === 0 ? {} : { minutes, fireAt: Date.parse(found.startAt) - minutes * 60_000 }),
    });
    return true;
  }

  return false;
}

function devFixtureApiPlugin(): Plugin {
  const store = createDevStore();
  return {
    name: "grace-dev-fixture-api",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? "";
        if (!rawUrl.startsWith("/api/")) {
          next();
          return;
        }
        const referer = req.headers.referer;
        if (referer && URL.parse(referer)?.searchParams.get("fixture") === "off") {
          next();
          return;
        }
        const url = new URL(rawUrl, "http://127.0.0.1");
        const path = url.pathname;
        const method = (req.method ?? "GET").toUpperCase();

        void readJsonBody(req).then((body) => {
          if (method === "GET" && path === "/api/auth/session") {
            sendJson(res, 200, { account: store.signedIn ? { id: ACCOUNT_ID, email: ACCOUNT_EMAIL } : null });
            return;
          }
          if (method === "POST" && path === "/api/auth/refresh") {
            if (!store.signedIn) {
              sendJson(res, 401, { error: "unauthorized" });
              return;
            }
            sendJson(res, 200, { account: { id: ACCOUNT_ID, email: ACCOUNT_EMAIL } });
            return;
          }
          if (method === "POST" && path === "/api/auth/logout") {
            store.signedIn = false;
            sendJson(res, 200, { ok: true });
            return;
          }
          if (method === "GET" && path === "/api/auth/providers") {
            sendJson(res, 200, { google: true, email: true, sms: true });
            return;
          }
          if (method === "POST" && (path === "/api/auth/email/send" || path === "/api/auth/sms/send")) {
            sendJson(res, 200, { ok: true });
            return;
          }
          if (method === "POST" && (path === "/api/auth/email/verify" || path === "/api/auth/sms/verify")) {
            store.signedIn = true;
            sendJson(res, 200, { ok: true });
            return;
          }
          if (method === "GET" && path === "/api/v1/billing/subscription") {
            sendJson(res, 200, { status: "active", canManage: true, canCheckout: false });
            return;
          }
          if (method === "GET" && path === "/api/v1/eliza/google/status") {
            sendJson(res, 200, {
              accountId: ACCOUNT_ID,
              provider: "google",
              side: "owner",
              mode: "cloud_managed",
              configured: true,
              connected: store.googleConnected,
              grantedCapabilities: store.googleConnected
                ? [
                    "google.gmail.triage",
                    "google.gmail.send",
                    "google.gmail.trash",
                    "google.calendar.read",
                    "google.calendar.write",
                  ]
                : [],
              connectionId: store.googleConnected ? GRANT_ID : null,
              identity: store.googleConnected ? { email: ACCOUNT_EMAIL } : null,
            });
            return;
          }
          if (method === "POST" && path === "/api/v1/eliza/google/disconnect") {
            store.googleConnected = false;
            sendJson(res, 200, { ok: true });
            return;
          }
          if (method === "GET" && path === "/api/product/files/scope") {
            if (!store.signedIn) {
              sendJson(res, 401, { error: "unauthorized" });
              return;
            }
            sendJson(res, 200, {
              accountId: ACCOUNT_ID,
              owner: store.ownerScope,
              session: store.sessionScope,
            });
            return;
          }
          if (method === "POST" && path === "/api/v1/voice/speech/consent") {
            sendJson(res, 200, { consentNonce: "dev-speech-nonce" });
            return;
          }
          if (method === "POST" && path === "/api/v1/voice/speech/session") {
            sendJson(res, 200, { version: 1, unavailable: true });
            return;
          }
          if (method === "POST" && path.startsWith("/api/v1/voice/speech/session/") && path.endsWith("/revoke")) {
            sendJson(res, 200, { ok: true });
            return;
          }
          if (handleMailEndpoints(store, method, path, url, body, res)) return;
          if (handleCalendarEndpoints(store, method, path, url, body, res)) return;
          next();
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [devFixtureApiPlugin(), vibelang(), react(), tailwindcss()],
  resolve: { conditions: ["eliza-source", ...defaultClientConditions] },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": { target: "http://localhost:8787", changeOrigin: true } },
  },
});
