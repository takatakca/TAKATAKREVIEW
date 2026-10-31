import https from "node:https";
import http from "node:http";
import { HttpsProxyAgent } from "https-proxy-agent";

// Preserve the managed environment's proxy and CA trust; never follow redirects
// with bearer credentials. Outbound destinations come from server configuration.
export function requestJson(
  url,
  { method = "GET", headers = {}, body, form, timeout = 15000 } = {},
) {
  const target = new URL(url);
  if (!["https:", "http:"].includes(target.protocol))
    throw new Error("Unsupported transport");
  if (
    target.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
  )
    throw new Error("HTTPS is required");
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname);
  const agent = proxy && !local ? new HttpsProxyAgent(proxy) : undefined;
  return new Promise((resolve, reject) => {
    const data = form
      ? new URLSearchParams(form).toString()
      : body === undefined
        ? null
        : JSON.stringify(body);
    const req = (target.protocol === "https:" ? https : http).request(
      target,
      {
        method,
        agent,
        headers: {
          Accept: "application/json",
          ...(data
            ? {
                "Content-Type": form
                  ? "application/x-www-form-urlencoded"
                  : "application/json",
                "Content-Length": Buffer.byteLength(data),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
          if (raw.length > 5_000_000) {
            res.destroy();
            reject(new Error("Provider response exceeded limit"));
          }
        });
        res.on("error", reject);
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode > 299)
            return reject(
              new Error(`Provider returned HTTP ${res.statusCode}`),
            );
          try {
            resolve(JSON.parse(raw || "{}"));
          } catch {
            reject(new Error("Provider returned invalid JSON"));
          }
        });
      },
    );
    req.setTimeout(timeout, () =>
      req.destroy(new Error("Provider request timed out")),
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}
