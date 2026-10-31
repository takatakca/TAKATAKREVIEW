import { createRemoteJWKSet, jwtVerify, customFetch } from "jose";
import { requestJson } from "./network.js";
import { fail } from "./domain.js";
const localHosts = ["localhost", "127.0.0.1", "[::1]", "::1"];
export function createAuth(env, transport = requestJson) {
  const production = env.NODE_ENV === "production";
  if (
    production &&
    (!env.AUTH_JWKS_URL ||
      !env.AUTH_ISSUER ||
      !env.AUTH_AUDIENCE ||
      !env.APP_ORIGIN)
  )
    throw new Error(
      "Production requires canonical AUTH_JWKS_URL, AUTH_ISSUER, AUTH_AUDIENCE and APP_ORIGIN.",
    );
  if (production) {
    for (const field of ["APP_ORIGIN", "AUTH_JWKS_URL", "AUTH_ISSUER"]) {
      let url;
      try {
        url = new URL(env[field]);
      } catch {
        throw new Error(`${field} must be a valid HTTPS URL.`);
      }
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        (field === "APP_ORIGIN" && url.origin !== env[field])
      )
        throw new Error(
          `${field} must use HTTPS and APP_ORIGIN must be an origin without a path.`,
        );
    }
  }
  const jwks = env.AUTH_JWKS_URL
    ? createRemoteJWKSet(new URL(env.AUTH_JWKS_URL), {
        [customFetch]: async (url) =>
          new Response(JSON.stringify(await transport(url)), {
            headers: { "Content-Type": "application/json" },
          }),
      })
    : null;
  return async (req, res, next) => {
    try {
      const cookies = Object.fromEntries(
        (req.headers.cookie || "")
          .split(";")
          .filter(Boolean)
          .map((s) => {
            const i = s.indexOf("=");
            return [s.slice(0, i).trim(), s.slice(i + 1)];
          }),
      );
      const token =
        req.headers.authorization?.replace(/^Bearer /, "") ||
        cookies.review_session;
      if (token && jwks) {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: env.AUTH_ISSUER,
          audience: env.AUTH_AUDIENCE,
          algorithms: ["RS256", "ES256"],
        });
        if (!Number.isFinite(payload.exp))
          fail(401, "Your workspace session must expire.");
        if (
          typeof payload.clientId !== "string" ||
          !payload.clientId ||
          !payload.sub
        )
          fail(403, "A signed workspace membership is required.");
        const roles = ["owner", "admin", "manager", "viewer"];
        if (!roles.includes(payload.role))
          fail(403, "A supported workspace role is required.");
        req.identity = {
          tenant: payload.clientId,
          userId: payload.sub,
          role: payload.role,
          mode: "canonical",
          expiresAt: payload.exp * 1000,
          modules: Array.isArray(payload.modules)
            ? payload.modules.filter((x) => typeof x === "string")
            : [],
        };
      } else if (
        !production &&
        !jwks &&
        localHosts.includes(req.hostname) &&
        ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
          req.socket.remoteAddress,
        )
      ) {
        req.identity = {
          tenant: "local",
          userId: "local-developer",
          role: "owner",
          mode: "local",
          modules: [],
        };
      } else fail(401, "Sign in through your TAKATAK workspace to continue.");
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        if (req.identity.role === "viewer")
          fail(403, "This workspace role is read-only.");
        const origin = req.headers.origin;
        if (origin) {
          let valid = false;
          try {
            const u = new URL(origin);
            valid =
              origin === env.APP_ORIGIN ||
              (!production && localHosts.includes(u.hostname));
          } catch {}
          if (!valid) fail(403, "Cross-origin writes are not allowed.");
        }
      }
      next();
    } catch (error) {
      next(
        error.status
          ? error
          : Object.assign(new Error("Your session is invalid or expired."), {
              status: 401,
            }),
      );
    }
  };
}
