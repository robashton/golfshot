import session, { type SessionData } from "express-session";
import type Database from "better-sqlite3";

export class SqliteSessionStore extends session.Store {
  private db: Database.Database;

  constructor(db: Database.Database) {
    super();
    this.db = db;
  }

  get(sid: string, callback: (err?: Error | null, session?: SessionData | null) => void): void {
    try {
      const row = this.db.prepare("SELECT sess FROM sessions WHERE sid = ? AND expired > datetime('now')").get(sid) as
        | { sess: string }
        | undefined;
      if (row) {
        callback(null, JSON.parse(row.sess));
      } else {
        callback(null, null);
      }
    } catch (err) {
      callback(err as Error);
    }
  }

  set(sid: string, session: SessionData, callback?: (err?: Error | null) => void): void {
    try {
      const maxAge = session.cookie.maxAge ?? 86400000;
      const expired = new Date(Date.now() + maxAge).toISOString();
      const sess = JSON.stringify(session);

      this.db
        .prepare("INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)")
        .run(sid, sess, expired);

      callback?.(null);
    } catch (err) {
      callback?.(err as Error);
    }
  }

  destroy(sid: string, callback?: (err?: Error | null) => void): void {
    try {
      this.db.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      callback?.(null);
    } catch (err) {
      callback?.(err as Error);
    }
  }

  touch(sid: string, session: SessionData, callback?: (err?: Error | null) => void): void {
    try {
      const maxAge = session.cookie.maxAge ?? 86400000;
      const expired = new Date(Date.now() + maxAge).toISOString();
      this.db.prepare("UPDATE sessions SET expired = ? WHERE sid = ?").run(expired, sid);
      callback?.(null);
    } catch (err) {
      callback?.(err as Error);
    }
  }
}
