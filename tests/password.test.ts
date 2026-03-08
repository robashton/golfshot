import { describe, it, expect } from "vitest";
import bcrypt from "bcrypt";

describe("password hashing", () => {
  it("hashes a password (not stored as plaintext)", async () => {
    const password = "mysecretpassword";
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    expect(hash.startsWith("$2")).toBe(true);
  });

  it("verifies correct password", async () => {
    const password = "mysecretpassword";
    const hash = await bcrypt.hash(password, 10);

    const valid = await bcrypt.compare(password, hash);
    expect(valid).toBe(true);
  });

  it("rejects incorrect password", async () => {
    const password = "mysecretpassword";
    const hash = await bcrypt.hash(password, 10);

    const valid = await bcrypt.compare("wrongpassword", hash);
    expect(valid).toBe(false);
  });
});
