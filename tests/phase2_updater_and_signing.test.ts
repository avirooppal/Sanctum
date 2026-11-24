import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const ROOT = process.cwd();
const HOST_EXE = path.join(ROOT, "deploy", "installer", "build_payload", "Sanctum-Desktop.exe");

function rsaPublicKeyToNetXml(pubKey: crypto.KeyObject): string {
  const jwk = pubKey.export({ format: "jwk" }) as { n: string; e: string };
  const nB64 = Buffer.from(jwk.n, "base64url").toString("base64");
  const eB64 = Buffer.from(jwk.e, "base64url").toString("base64");
  return `<RSAKeyValue><Modulus>${nB64}</Modulus><Exponent>${eB64}</Exponent></RSAKeyValue>`;
}

describe("Phase 2.6: Updater pinned signature, downgrade refusal & Authenticode build signing", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-p2-6-"));

  after(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch {}
  });

  test("UpdateVerifier verifies RSA-2048 signature + SHA-256 and refuses downgrades or tampering", () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pubXmlPath = path.join(tmpRoot, "pub.xml");
    fs.writeFileSync(pubXmlPath, rsaPublicKeyToNetXml(publicKey), "utf-8");

    const binPath = path.join(tmpRoot, "Sanctum-1.1.0.exe");
    const binBytes = Buffer.from("FAKE_SANCTUM_RELEASE_PAYLOAD_V110");
    fs.writeFileSync(binPath, binBytes);
    const sha256 = crypto.createHash("sha256").update(binBytes).digest("hex");

    const signManifest = (version: string, hash: string) => {
      const signer = crypto.createSign("RSA-SHA256");
      signer.update(`${version}\n${hash}`, "utf-8");
      return {
        version,
        exeSha256: hash,
        signature: signer.sign(privateKey, "base64"),
      };
    };

    const runVerify = (manifestObj: any, file: string, currentVer: string) => {
      const mPath = path.join(tmpRoot, `m-${Math.random().toString(36).slice(2)}.json`);
      fs.writeFileSync(mPath, JSON.stringify(manifestObj), "utf-8");
      const res = spawnSync(HOST_EXE, ["--verify-update", mPath, file, currentVer, "--pub-key-xml", pubXmlPath], {
        encoding: "utf-8",
        timeout: 10000,
      });
      return { status: res.status, json: JSON.parse(res.stdout.trim()) };
    };

    // 1. Valid upgrade 1.0.0 -> 1.1.0 passes
    const valid = runVerify(signManifest("1.1.0", sha256), binPath, "1.0.0");
    assert.equal(valid.status, 0);
    assert.equal(valid.json.ok, true);

    // 2. Downgrade 1.0.0 -> 0.9.9 refused
    const down = runVerify(signManifest("0.9.9", sha256), binPath, "1.0.0");
    assert.notEqual(down.status, 0);
    assert.equal(down.json.code, "downgrade_refused");

    // 3. Same version 1.0.0 -> 1.0.0 refused
    const same = runVerify(signManifest("1.0.0", sha256), binPath, "1.0.0");
    assert.notEqual(same.status, 0);
    assert.equal(same.json.code, "downgrade_refused");

    // 4. Tampered signature refused
    const badSig = signManifest("1.1.0", sha256);
    badSig.signature = Buffer.from("tampered_signature_bytes").toString("base64");
    const sigFail = runVerify(badSig, binPath, "1.0.0");
    assert.notEqual(sigFail.status, 0);
    assert.equal(sigFail.json.code, "signature_invalid");

    // 5. Tampered binary refused (checksum mismatch)
    const tamperedPath = path.join(tmpRoot, "Sanctum-tampered.exe");
    fs.writeFileSync(tamperedPath, Buffer.from("TAMPERED_BYTES"));
    const hashFail = runVerify(signManifest("1.1.0", sha256), tamperedPath, "1.0.0");
    assert.notEqual(hashFail.status, 0);
    assert.equal(hashFail.json.code, "checksum_mismatch");
  });

  test("build_installer.py Authenticode signing step works with a real self-signed test certificate and is a clean no-op without one", () => {
    const sampleExe = path.join(ROOT, "deploy", "installer", "build_payload", "Uninstall.exe");
    assert.ok(fs.existsSync(sampleExe), "Uninstall.exe must exist for signing test");
    const copyExe = path.join(tmpRoot, "Uninstall-sign-test.exe");
    fs.copyFileSync(sampleExe, copyExe);

    // 1. No-op without SANCTUM_SIGN_PFX
    const noopRes = spawnSync("python", ["tools/build_installer.py", "--sign-only", copyExe], {
      encoding: "utf-8",
      env: { ...process.env, SANCTUM_SIGN_PFX: "" },
      timeout: 15000,
    });
    assert.equal(noopRes.status, 0);
    assert.match(noopRes.stdout, /no-op/i);

    // 2. Real self-signed test cert in CurrentUser\My -> export PFX -> sign -> verify -> remove cert
    const pfxPath = path.join(tmpRoot, "test-codesign.pfx");
    const psCreate = `
      $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Sanctum Test Signer" -CertStoreLocation "Cert:\\CurrentUser\\My" -NotAfter (Get-Date).AddDays(1)
      $pw = ConvertTo-SecureString -String "testpass123" -Force -AsPlainText
      Export-PfxCertificate -Cert $cert -FilePath '${pfxPath.replace(/'/g, "''")}' -Password $pw | Out-Null
      Write-Output $cert.Thumbprint
    `;
    const certRes = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", psCreate], {
      encoding: "utf-8",
      timeout: 20000,
    });
    assert.equal(certRes.status, 0, `Cert creation failed: ${certRes.stderr}`);
    const thumbprint = certRes.stdout.trim();

    try {
      const signRes = spawnSync("python", ["tools/build_installer.py", "--sign-only", copyExe], {
        encoding: "utf-8",
        env: { ...process.env, SANCTUM_SIGN_PFX: pfxPath, SANCTUM_SIGN_PASS: "testpass123" },
        timeout: 20000,
      });
      assert.equal(signRes.status, 0, `Signing failed: ${signRes.stderr}\n${signRes.stdout}`);
      assert.match(signRes.stdout, /Sanctum Test Signer/);

      const verifyRes = spawnSync(
        "powershell",
        ["-NoProfile", "-NonInteractive", "-Command", `(Get-AuthenticodeSignature -LiteralPath '${copyExe.replace(/'/g, "''")}').SignerCertificate.Subject`],
        { encoding: "utf-8", timeout: 10000 }
      );
      assert.equal(verifyRes.status, 0);
      assert.match(verifyRes.stdout, /CN=Sanctum Test Signer/);
    } finally {
      if (thumbprint) {
        spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", `Remove-Item -Path "Cert:\\CurrentUser\\My\\${thumbprint}" -ErrorAction SilentlyContinue`]);
      }
    }
  });
});
