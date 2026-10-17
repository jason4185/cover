import "./styles.css";

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const handler = await import("@tanstack/react-start/server-entry");
    const entry = (handler.default ?? handler) as {
      fetch: (
        request: Request,
        env?: unknown,
        ctx?: unknown,
      ) => Response | Promise<Response>;
    };
    return entry.fetch(request, env, ctx);
  },
};
