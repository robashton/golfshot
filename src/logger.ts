import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_PATH = path.join(__dirname, "..", "data", "golfshot.log");

function ensureDir(): void {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function write(level: string, message: string, detail?: string): void {
  const ts = new Date().toISOString();
  let line = `[${ts}] [${level}] ${message}\n`;
  if (detail) {
    line += detail
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n") + "\n";
  }

  ensureDir();
  fs.appendFileSync(LOG_PATH, line);

  const consoleFn = level === "error" ? console.error : console.log;
  consoleFn(`[${level}] ${message}`);
  if (detail) {
    consoleFn(detail);
  }
}

export const logger = {
  info(message: string, detail?: string): void {
    write("info", message, detail);
  },
  warn(message: string, detail?: string): void {
    write("warn", message, detail);
  },
  error(message: string, detail?: string): void {
    write("error", message, detail);
  },
};
