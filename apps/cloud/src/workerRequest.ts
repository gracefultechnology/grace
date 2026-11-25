// spec/app/setup.md, "Story: Sign in to Grace and manage my subscription"
export function forwardedRequest(request: Request, name: string, value: string): Request {
  const headers = new Headers(request.headers);
  headers.set(name, value);
  return new Request(request, { headers });
}
