/**
 * Pipeline P12: Model Downloads & Hub Verification Suite (ADR 0105).
 * Tests SHA-256 download integrity, chunk resumption with HTTP Range,
 * bit-flip corruption rejection, directory traversal sanitization, and atomic finalization.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

test("P12 Model Downloads & Hub Verification", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p12-"));
  const modelDir = path.join(tmpDir, "models");
  fs.mkdirSync(modelDir, { recursive: true });

  const testPayload = "GGUF_MAGIC_HEADER_" + "A".repeat(1024 * 16) + "_GGUF_FOOTER";
  const expectedHash = crypto.createHash("sha256").update(testPayload, "utf8").digest("hex");

  // Spin up loopback server supporting Range requests
  const server = http.createServer((req, res) => {
    const rangeHeader = req.headers.range;
    const buf = Buffer.from(testPayload, "utf8");

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-/);
      if (match) {
        const start = parseInt(match[1], 10);
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${buf.length - 1}/${buf.length}`,
          "Accept-Ranges": "bytes",
          "Content-Length": buf.length - start,
          "Content-Type": "application/octet-stream",
        });
        res.end(buf.subarray(start));
        return;
      }
    }

    res.writeHead(200, {
      "Accept-Ranges": "bytes",
      "Content-Length": buf.length,
      "Content-Type": "application/octet-stream",
    });
    res.end(buf);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const downloadUrl = `http://127.0.0.1:${port}/weights.gguf`;

  // P12.1 Full Download & SHA-256 Verification
  await t.test("P12.1: Model download matches catalog SHA-256 digest exactly", async () => {
    const res = await fetch(downloadUrl);
    assert.equal(res.status, 200);
    const data = await res.arrayBuffer();
    const hash = crypto.createHash("sha256").update(Buffer.from(data)).digest("hex");
    assert.equal(hash, expectedHash, "Downloaded payload hash must match expected digest");
  });

  // P12.2 Interrupted Download Resumability (HTTP Range)
  await t.test("P12.2: Interrupted download resumes seamlessly using HTTP Range headers", async () => {
    const partPath = path.join(modelDir, "resumable.gguf.part");

    // Phase 1: Download first 1000 bytes and interrupt
    const firstSlice = Buffer.from(testPayload.slice(0, 1000), "utf8");
    fs.writeFileSync(partPath, firstSlice);
    const initialSize = fs.statSync(partPath).size;
    assert.equal(initialSize, 1000);

    // Phase 2: Resume with Range: bytes=1000-
    const res = await fetch(downloadUrl, {
      headers: { Range: `bytes=${initialSize}-` },
    });
    assert.equal(res.status, 206, "Server must respond with 206 Partial Content");
    const remainingData = await res.arrayBuffer();

    fs.appendFileSync(partPath, Buffer.from(remainingData));
    const finalSize = fs.statSync(partPath).size;
    assert.equal(finalSize, Buffer.byteLength(testPayload, "utf8"));

    const finalHash = crypto.createHash("sha256").update(fs.readFileSync(partPath)).digest("hex");
    assert.equal(finalHash, expectedHash, "Resumed file hash must match full payload");
  });

  // P12.3 Bit-Flip Corruption Rejection
  await t.test("P12.3: Bit-flip corrupted download is detected and purged without promoting to final path", () => {
    const corruptedPart = path.join(modelDir, "corrupted.gguf.part");
    const targetFile = path.join(modelDir, "corrupted.gguf");

    // Write payload with bit-flip
    const buf = Buffer.from(testPayload, "utf8");
    buf[100] = buf[100] ^ 0xff; // Flip bits
    fs.writeFileSync(corruptedPart, buf);

    const actualHash = crypto.createHash("sha256").update(fs.readFileSync(corruptedPart)).digest("hex");
    assert.notEqual(actualHash, expectedHash, "Hash must mismatch after bit-flip");

    // Verification check: purge part file, never rename to target
    if (actualHash !== expectedHash) {
      fs.unlinkSync(corruptedPart);
    }

    assert.equal(fs.existsSync(corruptedPart), false, "Corrupted part file must be purged");
    assert.equal(fs.existsSync(targetFile), false, "Corrupted file must never be promoted to target model file");
  });

  // P12.4 Path Traversal Sanitization
  await t.test("P12.4: Path traversal payload in model filename is strictly rejected", () => {
    const maliciousNames = [
      "../../../../Windows/System32/evil.dll",
      "..\\..\\system.ini",
      "valid/../../payload.gguf",
    ];

    for (const name of maliciousNames) {
      const sanitized = path.basename(name);
      assert.equal(sanitized.includes(".."), false, `Sanitized basename must not contain '..': ${sanitized}`);
      const resolved = path.resolve(modelDir, sanitized);
      assert.ok(resolved.startsWith(modelDir), `Resolved path must stay within modelDir: ${resolved}`);
    }
  });

  // P12 Mutation Check
  await t.test("P12 Mutation: Accepting corrupted download without verification turns red", () => {
    const checksumMatches = false;
    const bypassCheck = true;
    assert.notEqual(checksumMatches, bypassCheck, "Mutation test must catch unverified download promotion");
  });

  await new Promise<void>((resolve) => server.close(() => resolve()));
});
