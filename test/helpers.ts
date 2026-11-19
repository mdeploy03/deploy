import { env } from "cloudflare:test";
import app from "../src/worker/index";

const ctx = { waitUntil() {}, passThroughOnException() {}, props: {} } as unknown as ExecutionContext;

export function call(path: string, init?: RequestInit, overrides: Record<string, unknown> = {}) {
  return app.fetch(new Request(`https://werkruimte.test${path}`, init), { ...env, ...overrides }, ctx);
}

export async function api<T = any>(method: string, path: string, body?: unknown) {
  const res = await call(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: (text ? JSON.parse(text) : null) as T };
}
