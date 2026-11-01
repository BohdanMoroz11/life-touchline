import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getMatches } from "./match.ts";
import { getMatch } from "./data.ts";
import { getTeam } from "./team.ts";
import { getPlayer } from "./player.ts";
import { getTable } from "./standings.ts";
import { cacheStats } from "./espn.ts";

const PORT = Number(process.env.PORT ?? 5190);
const HOST = process.env.HOST ?? "127.0.0.1"; // local default; the container sets HOST and PORT
const root = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const route = (fn: (req: express.Request) => Promise<unknown>): express.RequestHandler => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: (err as Error).message });
  }
};
const q = (req: express.Request, k: string) => (typeof req.query[k] === "string" ? (req.query[k] as string) : undefined);

app.get("/api/health", (_req, res) => res.json({ ok: true, ...cacheStats() }));
app.get("/api/matches", route((req) => getMatches(q(req, "date") ?? new Date().toISOString().slice(0, 10).replace(/-/g, ""))));
app.get("/api/match/:league/:id", route((req) => getMatch(req.params.league, req.params.id)));
app.get("/api/team/:league/:id", route((req) => getTeam(req.params.league, req.params.id, { fm: q(req, "fm"), at: q(req, "at") })));
app.get("/api/table/:league", route((req) => getTable(req.params.league)));
app.get("/api/player/:id", route((req) => getPlayer(req.params.id, q(req, "fm"))));

// In production mode serve the built frontend.
const dist = path.join(root, "../dist");
app.use(express.static(dist));
app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, "index.html")));

app.listen(PORT, HOST, () => console.log(`football-tracker on http://${HOST}:${PORT}`));
