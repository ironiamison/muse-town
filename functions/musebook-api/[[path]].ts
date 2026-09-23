type PagesContext = {
  request: Request;
  params: { path?: string | string[] };
};

export async function onRequest({ request, params }: PagesContext) {
  const path = Array.isArray(params.path)
    ? params.path.join("/")
    : params.path || "";
  const incoming = new URL(request.url);
  const target = new URL(`https://musebook.me/${path}`);
  target.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("origin");
  headers.set("accept", "application/json");

  const response = await fetch(target, {
    method: request.method,
    headers,
    body:
      request.method === "GET" || request.method === "HEAD"
        ? undefined
        : request.body,
    redirect: "manual",
  });

  const outgoingHeaders = new Headers(response.headers);
  outgoingHeaders.delete("set-cookie");
  outgoingHeaders.set("cache-control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outgoingHeaders,
  });
}
