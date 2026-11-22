import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { expect, it } from "vitest";
import { startWebArenaWorker } from "./webarena.ts";

const fakeEvaluator = `
import json
import os
import urllib.request

def wait_for_test(phase):
    with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(f"{os.environ['TEST_BARRIER']}/{phase}/{os.getpid()}") as response:
        response.read()

wait_for_test(os.environ["TEST_IMPORT"])
if os.environ["TEST_IMPORT"] == "failing-import":
    raise RuntimeError("private fixture diagnostics")

class URLEvaluator:
    def __call__(self, trajectory, config, page, page_client):
        task = json.loads(config.read_text())
        if task.get("hang"):
            wait_for_test("grading")
        assert trajectory == [] and page_client is None
        assert page.url in (task["target"], task["control"])
        return int(page.url == task["target"])
`;

const fakePage = `
class PseudoPage:
    def __init__(self, _, url):
        self.url = url
`;

it('Wait for the evaluator and reap failed grading (spec/app/workspace.md, "Story: Follow one reviewed plan across apps")', async ({ skip }) => {
  const interpreter = spawnSync("python3", ["-IB", "-c", "import sys; print(sys.executable)"], { encoding: "utf8", timeout: 30_000 });
  if (interpreter.error && "code" in interpreter.error && interpreter.error.code === "ENOENT") return skip();
  expect(interpreter.status).toBe(0);
  const python = interpreter.stdout.trim();
  const root = await mkdtemp(join(tmpdir(), "grace-webarena-worker-"));
  type Phase = "importing" | "failing-import" | "cancelled-import" | "stalled-import" | "grading";
  type Gate = { pid: number; release: () => void };
  const gates = new EventEmitter<Record<Phase, [Gate]>>();
  const enter = async (phase: Phase) => {
    const cleanup = new AbortController();
    try {
      const pending = new Promise<Gate>((resolve) => { gates.once(phase, resolve); });
      return await Promise.race([pending, Effect.runPromise(Effect.sleep("30 seconds"), { signal: cleanup.signal }).then(() => {
        throw new Error(`The fixture did not reach ${phase}`);
      })]);
    } finally {
      cleanup.abort();
    }
  };
  const responses = new Set<ServerResponse>();
  const server = createServer((request, response) => {
    const [, phase, rawPid] = request.url?.split("/") ?? [];
    const pid = Number(rawPid);
    if ((phase !== "importing" && phase !== "failing-import" && phase !== "cancelled-import" && phase !== "stalled-import" && phase !== "grading") ||
        !Number.isSafeInteger(pid) || pid < 1) {
      response.writeHead(400).end();
      return;
    }
    responses.add(response);
    response.once("close", () => responses.delete(response));
    gates.emit(phase, { pid, release: () => response.end() });
  });
  const workers: ReturnType<typeof startWebArenaWorker>[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") throw new Error("The evaluator fixture did not bind a loopback port");
    const module = join(root, "evaluation_harness");
    await mkdir(module);
    await Promise.all([
      writeFile(join(module, "__init__.py"), fakeEvaluator),
      writeFile(join(module, "helper_functions.py"), fakePage),
    ]);
    const gradingTimeoutMs = 1000;
    const start = (phase: Exclude<Phase, "grading">, startupTimeoutMs?: number) => {
      const worker = startWebArenaWorker({
        python, root, gradingTimeoutMs, startupTimeoutMs, env: { TEST_BARRIER: `http://127.0.0.1:${address.port}`, TEST_IMPORT: phase },
      });
      workers.push(worker);
      return worker;
    };
    const target = "https://localhost/expected";
    const control = "https://localhost/";
    const fixture = { target, control };
    const urls = [target, control] as const;
    const worker = start("importing");
    const scores = worker.grade({ fixture: JSON.stringify(fixture), urls });
    const completion = scores.then(() => "graded", () => "failed");
    const importGate = await enter("importing");
    expect(await Promise.race([completion, Effect.runPromise(Effect.as(Effect.sleep(gradingTimeoutMs * 2), "importing"))])).toBe("importing");
    importGate.release();
    await expect(scores).resolves.toEqual([1, 0]);

    const nextImport = enter("importing");
    const gradingFailure = worker.grade({ fixture: JSON.stringify({ ...fixture, hang: true }), urls }).catch((error: unknown) => error);
    const nextScores = worker.grade({ fixture: JSON.stringify(fixture), urls });
    const gradeGate = await enter("grading");
    expect(gradeGate.pid).toBe(importGate.pid);
    expect(await gradingFailure).toMatchObject({ phase: "grading", reason: "deadline" });
    expect(() => process.kill(gradeGate.pid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));

    const fresh = await nextImport;
    expect(fresh.pid).not.toBe(importGate.pid);
    fresh.release();
    await expect(nextScores).resolves.toEqual([1, 0]);
    await worker.close();
    expect(() => process.kill(fresh.pid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));

    const failing = start("failing-import");
    const startupFailure = failing.ready.catch((error: unknown) => error);
    const failGate = await enter("failing-import");
    failGate.release();
    const failed = await startupFailure;
    expect(failed).toMatchObject({ phase: "startup", reason: "exit" });
    expect(String(failed)).not.toContain("private fixture diagnostics");
    expect(() => process.kill(failGate.pid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));

    const stalledGate = enter("stalled-import");
    const stalled = start("stalled-import", 10_000);
    const stalledFailure = stalled.ready.catch((error: unknown) => error);
    const blocked = await stalledGate;
    expect(await stalledFailure).toMatchObject({ phase: "startup", reason: "deadline" });
    expect(() => process.kill(blocked.pid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));

    const cancelling = start("cancelled-import");
    const cancelled = cancelling.ready.catch((error: unknown) => error);
    const cancelGate = await enter("cancelled-import");
    await Promise.all([cancelling.close(), cancelling.close()]);
    expect(await cancelled).toMatchObject({ phase: "startup", reason: "closed" });
    expect(() => process.kill(cancelGate.pid, 0)).toThrow(expect.objectContaining({ code: "ESRCH" }));
  } finally {
    await Promise.all(workers.map((worker) => worker.close()));
    for (const response of responses) response.destroy();
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
}, 90_000);
