import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer as createPlainServer } from "node:http";
import { createServer } from "node:https";
import { connect, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";

export function selfSigned(commonName: string) {
  const temporary = mkdtempSync(join(tmpdir(), "grace-new-tls-"));
  try {
    const cert = join(temporary, "cert.pem");
    const key = join(temporary, "key.pem");
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1", "-subj", `/CN=${commonName}`, "-keyout", key, "-out", cert], { stdio: "ignore" });
    return { key: readFileSync(key), cert: readFileSync(cert) };
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

export const secureListener = () => NodeHttpServer.layer(() => createServer(selfSigned("localhost")), { port: 0, host: "127.0.0.1", gracefulShutdownTimeout: 0 });

export async function loopbackNames(securePort: number) {
  const sockets = new Set<Socket>();
  const server = createPlainServer((_, response) => response.writeHead(405).end());
  server.on("connect", (request, client: Socket, head: Buffer) => {
    const asked = URL.canParse(`https://${request.url}`) ? new URL(`https://${request.url}`) : undefined;
    if (!asked?.hostname.endsWith(".localhost") || asked.port !== "") { client.end("HTTP/1.1 403 Forbidden\r\n\r\n"); return; }
    const site = connect(securePort, "127.0.0.1");
    for (const socket of [client, site]) {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
      socket.once("error", () => { client.destroy(); site.destroy(); });
    }
    site.once("connect", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      site.write(head);
      site.pipe(client).pipe(site);
    });
  });
  await new Promise<void>((ready, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", ready); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("The loopback names need a local port");
  return {
    proxy: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((closed) => {
      for (const socket of sockets) socket.destroy();
      server.close(() => closed());
    }),
  };
}
