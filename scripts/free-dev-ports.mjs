/**
 * Frees default dev ports so `npm run dev` can bind API (3000), traffic Vite (8080),
 * and contacts Vite (5173). Safe to run when nothing is listening (no-op).
 */
import { execSync } from "node:child_process";

const ports = [3000, 8080, 5173];

if (process.platform === "win32") {
  for (const port of ports) {
    try {
      const out = execSync(`netstat -ano | findstr :${port}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const pids = new Set();
      for (const line of out.split("\n")) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* no match */
    }
  }
} else {
  for (const port of ports) {
    try {
      const out = execSync(`lsof -ti :${port}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
      if (!out) continue;
      for (const pid of out.split(/\n/).map((s) => s.trim()).filter(Boolean)) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: "ignore" });
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* lsof: no process on this port */
    }
  }
}
