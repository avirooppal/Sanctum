using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Phase 2.6: Release update verification with pinned RSA-2048 public key,
    /// mandatory SHA-256 checksum check, and strict SemVer downgrade refusal.
    /// </summary>
    public static class UpdateVerifier {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);

        // Pinned release signing public key (RSA-2048 XML). Replace with production release key when publishing signed releases.
        public const string PinnedPublicKeyXml =
            "<RSAKeyValue><Modulus>v3J7N1k9M4x8Q2p5W6z1R8t3Y5u7I9o2P4a6S8d1F3g5H7j9K2l4Z6x8C1v3B5n7M9q2W4e6R8t1Y3u5I7o9P2a4S6d8F1g3H5j7K9l2Z4x6C8v1B3n5M7q9W2e4R6t8Y1u3I5o7P9a2S4d6F8g1H3j5K7l9Z2x4C6v8B1n3M5q7W9e2R4t6Y8u1I3o5P7a9S2d4F6g8H1j3K5l7Z9x2C4v6B8n1M3q5W7e9R2t4Y6u8I1o3P5a7S9d2F4g6H8j1K3l5Z7x9C2v4B6n8M1q3W5e7R9t2Y4u6I8o1P3a5S7d9F2g4H6j8K1l3Z5x7C9v2B4n6M8q1W3e5R7t9Y2u4I6o8P1==</Modulus><Exponent>AQAB</Exponent></RSAKeyValue>";

        public static bool IsStrictlyNewerVersion(string currentVersion, string candidateVersion) {
            if (!TryParseSemVer(currentVersion, out var cur) || !TryParseSemVer(candidateVersion, out var cand)) {
                return false;
            }
            if (cand.Item1 != cur.Item1) return cand.Item1 > cur.Item1;
            if (cand.Item2 != cur.Item2) return cand.Item2 > cur.Item2;
            return cand.Item3 > cur.Item3;
        }

        public static bool IsNotDowngradeVersion(string currentVersion, string candidateVersion) {
            if (!TryParseSemVer(currentVersion, out var cur) || !TryParseSemVer(candidateVersion, out var cand)) {
                return false;
            }
            if (cand.Item1 != cur.Item1) return cand.Item1 > cur.Item1;
            if (cand.Item2 != cur.Item2) return cand.Item2 > cur.Item2;
            return cand.Item3 >= cur.Item3;
        }

        private static bool TryParseSemVer(string raw, out Tuple<int, int, int> ver) {
            ver = null;
            if (string.IsNullOrWhiteSpace(raw)) return false;
            string s = raw.Trim().TrimStart('v', 'V');
            int plus = s.IndexOf('+');
            if (plus >= 0) s = s.Substring(0, plus);
            int dash = s.IndexOf('-');
            if (dash >= 0) s = s.Substring(0, dash);
            string[] parts = s.Split('.');
            if (parts.Length < 2) return false;
            if (!int.TryParse(parts[0], out int maj) || !int.TryParse(parts[1], out int min)) return false;
            int pat = 0;
            if (parts.Length >= 3 && !int.TryParse(parts[2], out pat)) return false;
            ver = Tuple.Create(maj, min, pat);
            return true;
        }

        public static string ComputeFileSha256(string filePath) {
            using (var sha = SHA256.Create())
            using (var fs = File.OpenRead(filePath)) {
                return BitConverter.ToString(sha.ComputeHash(fs)).Replace("-", "").ToLowerInvariant();
            }
        }

        public static (bool ok, string code, string error) VerifyUpdatePackage(
            JObject manifest,
            string downloadedFilePath,
            string currentVersion,
            string publicKeyXmlOverride = null) {
            if (manifest == null) return (false, "invalid_manifest", "Update manifest is missing.");
            if (string.IsNullOrWhiteSpace(downloadedFilePath) || !File.Exists(downloadedFilePath)) {
                return (false, "missing_file", "Downloaded update file not found.");
            }

            string candidateVersion = manifest["version"]?.Value<string>() ?? "";
            if (!IsStrictlyNewerVersion(currentVersion, candidateVersion)) {
                return (false, "downgrade_refused", $"Update refused: candidate version '{candidateVersion}' is not strictly newer than current '{currentVersion}'.");
            }

            string expectedSha256 = (manifest["exeSha256"]?.Value<string>() ?? "").Trim().ToLowerInvariant();
            if (expectedSha256.Length != 64) {
                return (false, "missing_checksum", "Update manifest is missing a valid 64-char SHA-256 checksum.");
            }

            string actualSha256 = ComputeFileSha256(downloadedFilePath);
            if (!string.Equals(actualSha256, expectedSha256, StringComparison.OrdinalIgnoreCase)) {
                return (false, "checksum_mismatch", $"SHA-256 mismatch: expected {expectedSha256}, got {actualSha256}.");
            }

            string signatureB64 = manifest["signature"]?.Value<string>() ?? "";
            if (string.IsNullOrWhiteSpace(signatureB64)) {
                return (false, "missing_signature", "Update manifest is missing cryptographic signature.");
            }

            // Canonical signed payload: "<version>\n<exeSha256>"
            string signedPayload = candidateVersion.Trim() + "\n" + expectedSha256;
            byte[] payloadBytes = Utf8NoBom.GetBytes(signedPayload);
            byte[] sigBytes;
            try {
                sigBytes = Convert.FromBase64String(signatureB64.Trim());
            } catch {
                return (false, "invalid_signature_encoding", "Manifest signature is not valid Base64.");
            }

            try {
                using (var rsa = new RSACryptoServiceProvider()) {
                    rsa.FromXmlString(string.IsNullOrWhiteSpace(publicKeyXmlOverride) ? PinnedPublicKeyXml : publicKeyXmlOverride);
                    bool valid = rsa.VerifyData(payloadBytes, CryptoConfig.MapNameToOID("SHA256"), sigBytes);
                    if (!valid) {
                        return (false, "signature_invalid", "Manifest cryptographic signature verification failed.");
                    }
                }
            } catch (Exception ex) {
                return (false, "signature_error", "Signature verification error: " + ex.Message);
            }

            return (true, "ok", "");
        }
    }
}
