// spec/app/setup.md, "Story: Sign in to Grace and manage my subscription"
export function forwardedRequest(request: Request, name: string, value: string): Request {
  const headers = new Headers(request.headers);
  headers.set(name, value);
  return new Request(request, { headers });
}

export function stripeWebhookRequest(request: Request, url: URL): Request {
  if (request.method !== "POST" || url.pathname !== "/api/v1/billing/webhook") return request;
  const destination = new URL(url);
  destination.pathname = "/api/stripe/webhook";
  return new Request(destination, request);
}

export function isReturnTemplate(pathname: string): boolean {
  try {
    return /^\/(?:return-to-app(?:\.connected)?|checkout-outcome\.(?:paid|canceled))\.html$/.test(decodeURI(pathname));
  } catch {
    return false;
  }
}
