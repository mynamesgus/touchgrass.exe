const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { decryptBuffer } = require("../crypto/decrypt");

const router = express.Router();

const manifestPath = path.join(
  __dirname,
  "../../records/evidence-manifest.json"
);
const vaultDir = path.join(__dirname, "../../vault");

/* =========================
   GET /api/export (ENCRYPTED)
   ========================= */
router.get("/export", (req, res) => {
  try {
    if (!fs.existsSync(manifestPath)) {
      return res.status(400).json({ error: "No evidence to export" });
    }

    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=forensic_export.zip"
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    /* -------- Add encrypted evidence -------- */
    manifest.forEach(record => {
      const vaultFilePath = path.join(vaultDir, record.vaultFile);
      if (fs.existsSync(vaultFilePath)) {
        archive.file(vaultFilePath, {
          name: `evidence/${record.vaultFile}`
        });
      }
    });

    /* -------- Add manifest -------- */
    archive.append(
      JSON.stringify(manifest, null, 2),
      { name: "manifest.json" }
    );

    /* -------- Add timeline -------- */
    const timeline = manifest
      .slice()
      .sort((a, b) => {
        return (
          new Date(a.metadata.uploadTime) -
          new Date(b.metadata.uploadTime)
        );
      })
      .map((item, index) => ({
        sequence: index + 1,
        evidenceId: item.evidenceId,
        timestamp: item.metadata.uploadTime,
        platform: item.metadata.platform,
        originalName: item.metadata.originalName,
        sha256: item.sha256
      }));

    archive.append(
      JSON.stringify(timeline, null, 2),
      { name: "timeline.json" }
    );

    /* -------- README -------- */
    const readme = `
FORENSIC EVIDENCE PACKAGE

This archive contains encrypted digital evidence and
associated integrity records.

Contents:
- evidence/: AES-256-GCM encrypted evidence files
- manifest.json: Chain-of-custody record
- timeline.json: Chronological sequence of evidence

Integrity:
- Each evidence item is identified by its SHA-256 hash.
- Hashes were computed BEFORE encryption.
- Evidence has not been modified since ingestion.

Generated at: ${new Date().toISOString()}
`;

    archive.append(readme.trim(), { name: "README.txt" });

    archive.finalize();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   GET /api/export/decrypted
   ========================= */
router.get("/export/decrypted", (req, res) => {
  try {
    if (!fs.existsSync(manifestPath)) {
      return res.status(400).json({ error: "No evidence to export" });
    }

    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    );

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=forensic_export_decrypted.zip"
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(res);

    const key = Buffer.from(process.env.EVIDENCE_ENC_KEY, "hex");

    /* -------- Decrypt & add evidence -------- */
    manifest.forEach(record => {
      const vaultPath = path.join(vaultDir, record.vaultFile);
      if (!fs.existsSync(vaultPath)) return;

      const payload = fs.readFileSync(vaultPath);
      const plaintext = decryptBuffer(payload, key);

      const safeName = `${record.evidenceId}_${record.metadata.originalName}`;

      archive.append(plaintext, {
        name: `evidence/${safeName}`
      });
    });

    /* -------- Add manifest -------- */
    archive.append(
      JSON.stringify(manifest, null, 2),
      { name: "manifest.json" }
    );

    archive.finalize();

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
