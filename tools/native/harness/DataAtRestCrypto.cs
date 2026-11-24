using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Sanctum.Harness {
    /// <summary>
    /// Phase 2.5: Data-at-rest encryption using Windows DPAPI (CurrentUser) by default
    /// plus passphrase-derived AES-256-CBC + HMAC-SHA256 (PBKDF2 100k iterations) for portable archives.
    /// </summary>
    public static class DataAtRestCrypto {
        private static readonly UTF8Encoding Utf8NoBom = new UTF8Encoding(false);
        private static readonly byte[] DpapiEntropy = Utf8NoBom.GetBytes("Sanctum.DataAtRest.v1");
        public const string DpapiPrefix = "SANCTUM_DPAPI_V1:";
        public const string Pbkdf2Prefix = "SANCTUM_PBKDF2_V1:";
        private const int Pbkdf2Iterations = 100000;

        private static readonly object ConfigLock = new object();
        private static string _appDataDir = "";
        private static bool _dpapiEnabled = false;

        public static void Initialize(string appDataDir) {
            lock (ConfigLock) {
                _appDataDir = appDataDir ?? "";
                _dpapiEnabled = false;
                try {
                    string cfgPath = Path.Combine(_appDataDir, "encryption_config.json");
                    if (File.Exists(cfgPath)) {
                        var obj = CanonicalJson.ParseObject(File.ReadAllText(cfgPath, Utf8NoBom));
                        _dpapiEnabled = obj["enabled"]?.Value<bool>() ?? false;
                    }
                } catch { }
            }
        }

        public static bool IsDpapiEnabled {
            get { lock (ConfigLock) return _dpapiEnabled; }
        }

        public static JObject GetStatus() {
            lock (ConfigLock) {
                return new JObject {
                    ["enabled"] = _dpapiEnabled,
                    ["mode"] = "dpapi_current_user",
                    ["portableArchiveKdf"] = "PBKDF2-HMAC-SHA256 (100000 iterations) + AES-256-CBC + HMAC-SHA256"
                };
            }
        }

        public static (int status, JObject body) SetDpapiEnabled(bool enabled, bool viaTrustedChannel) {
            if (!viaTrustedChannel) {
                return (403, new JObject {
                    ["error"] = "Changing data-at-rest encryption policy requires trusted-channel approval.",
                    ["code"] = "trusted_channel_required"
                });
            }
            lock (ConfigLock) {
                _dpapiEnabled = enabled;
                if (!string.IsNullOrEmpty(_appDataDir)) {
                    string cfgPath = Path.Combine(_appDataDir, "encryption_config.json");
                    Directory.CreateDirectory(_appDataDir);
                    var doc = new JObject {
                        ["enabled"] = _dpapiEnabled,
                        ["mode"] = "dpapi_current_user",
                        ["updatedAt"] = DateTime.UtcNow.ToString("o")
                    };
                    File.WriteAllText(cfgPath, doc.ToString(Formatting.Indented), Utf8NoBom);
                    WindowsAclHelper.ApplyUserOnlyFileAcl(cfgPath);
                }
                return (200, GetStatus());
            }
        }

        public static string ProtectDpapi(string plaintext) {
            byte[] plainBytes = Utf8NoBom.GetBytes(plaintext ?? "");
            byte[] cipherBytes = ProtectedData.Protect(plainBytes, DpapiEntropy, DataProtectionScope.CurrentUser);
            return DpapiPrefix + Convert.ToBase64String(cipherBytes);
        }

        public static string UnprotectDpapi(string payload) {
            if (string.IsNullOrEmpty(payload) || !payload.StartsWith(DpapiPrefix, StringComparison.Ordinal)) {
                return payload;
            }
            byte[] cipherBytes = Convert.FromBase64String(payload.Substring(DpapiPrefix.Length).Trim());
            byte[] plainBytes = ProtectedData.Unprotect(cipherBytes, DpapiEntropy, DataProtectionScope.CurrentUser);
            return Utf8NoBom.GetString(plainBytes);
        }

        public static void WriteTextFile(string filePath, string content) {
            Directory.CreateDirectory(Path.GetDirectoryName(filePath));
            string toWrite = IsDpapiEnabled ? ProtectDpapi(content) : (content ?? "");
            File.WriteAllText(filePath, toWrite, Utf8NoBom);
            WindowsAclHelper.ApplyUserOnlyFileAcl(filePath);
        }

        public static string ReadTextFile(string filePath) {
            string raw = File.ReadAllText(filePath, Utf8NoBom);
            if (raw.StartsWith(DpapiPrefix, StringComparison.Ordinal)) {
                return UnprotectDpapi(raw);
            }
            return raw;
        }

        public static string EncryptWithPassphrase(string plaintext, string passphrase) {
            if (string.IsNullOrEmpty(passphrase) || passphrase.Length < 8) {
                throw new ArgumentException("Passphrase must be at least 8 characters.");
            }
            byte[] salt = new byte[16];
            byte[] iv = new byte[16];
            using (var rng = new RNGCryptoServiceProvider()) {
                rng.GetBytes(salt);
                rng.GetBytes(iv);
            }

            byte[] encKey;
            byte[] macKey;
            using (var kdf = new Rfc2898DeriveBytes(passphrase, salt, Pbkdf2Iterations, HashAlgorithmName.SHA256)) {
                encKey = kdf.GetBytes(32);
                macKey = kdf.GetBytes(32);
            }

            byte[] cipher;
            using (var aes = Aes.Create()) {
                aes.KeySize = 256;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;
                aes.Key = encKey;
                aes.IV = iv;
                using (var enc = aes.CreateEncryptor()) {
                    byte[] plainBytes = Utf8NoBom.GetBytes(plaintext ?? "");
                    cipher = enc.TransformFinalBlock(plainBytes, 0, plainBytes.Length);
                }
            }

            // Format: salt(16) || iv(16) || cipher || hmac(32)
            byte[] dataToMac = new byte[salt.Length + iv.Length + cipher.Length];
            Buffer.BlockCopy(salt, 0, dataToMac, 0, salt.Length);
            Buffer.BlockCopy(iv, 0, dataToMac, salt.Length, iv.Length);
            Buffer.BlockCopy(cipher, 0, dataToMac, salt.Length + iv.Length, cipher.Length);

            byte[] mac;
            using (var hmac = new HMACSHA256(macKey)) {
                mac = hmac.ComputeHash(dataToMac);
            }

            byte[] full = new byte[dataToMac.Length + mac.Length];
            Buffer.BlockCopy(dataToMac, 0, full, 0, dataToMac.Length);
            Buffer.BlockCopy(mac, 0, full, dataToMac.Length, mac.Length);
            return Pbkdf2Prefix + Convert.ToBase64String(full);
        }

        public static string DecryptWithPassphrase(string archive, string passphrase) {
            if (string.IsNullOrEmpty(archive) || !archive.StartsWith(Pbkdf2Prefix, StringComparison.Ordinal)) {
                throw new ArgumentException("Invalid encrypted archive header.");
            }
            byte[] full = Convert.FromBase64String(archive.Substring(Pbkdf2Prefix.Length).Trim());
            if (full.Length < 16 + 16 + 16 + 32) {
                throw new CryptographicException("Truncated encrypted archive.");
            }

            byte[] salt = new byte[16];
            byte[] iv = new byte[16];
            int cipherLen = full.Length - 16 - 16 - 32;
            byte[] cipher = new byte[cipherLen];
            byte[] storedMac = new byte[32];
            Buffer.BlockCopy(full, 0, salt, 0, 16);
            Buffer.BlockCopy(full, 16, iv, 0, 16);
            Buffer.BlockCopy(full, 32, cipher, 0, cipherLen);
            Buffer.BlockCopy(full, full.Length - 32, storedMac, 0, 32);

            byte[] encKey;
            byte[] macKey;
            using (var kdf = new Rfc2898DeriveBytes(passphrase ?? "", salt, Pbkdf2Iterations, HashAlgorithmName.SHA256)) {
                encKey = kdf.GetBytes(32);
                macKey = kdf.GetBytes(32);
            }

            byte[] expectedMac;
            using (var hmac = new HMACSHA256(macKey)) {
                expectedMac = hmac.ComputeHash(full, 0, full.Length - 32);
            }

            int diff = 0;
            for (int i = 0; i < 32; i++) diff |= (storedMac[i] ^ expectedMac[i]);
            if (diff != 0) {
                throw new CryptographicException("Invalid passphrase or corrupted archive (HMAC mismatch).");
            }

            using (var aes = Aes.Create()) {
                aes.KeySize = 256;
                aes.Mode = CipherMode.CBC;
                aes.Padding = PaddingMode.PKCS7;
                aes.Key = encKey;
                aes.IV = iv;
                using (var dec = aes.CreateDecryptor()) {
                    byte[] plain = dec.TransformFinalBlock(cipher, 0, cipher.Length);
                    return Utf8NoBom.GetString(plain);
                }
            }
        }
    }
}
