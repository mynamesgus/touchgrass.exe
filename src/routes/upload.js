const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { encryptBuffer } = require("../crypto/encrypt");

const router = express.Router();

/* =========================
   Multer: MEMORY storage
   ========================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      "image/png",
      "image/jpeg",
      "application/pdf",
      "text/plain"
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  }
});

/* =========================
   Paths
   ========================= */
const vaultDir = path.join(__dirname, "../../vault");
const manifestPath = path.join(
  __dirname,
  "../../records/evidence-manifest.json"
);

/* =========================
   POST /api/upload
   ========================= */
router.post("/upload", upload.single("evidence"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    /* -------- STEP 3: HASH FIRST -------- */
    const sha256 = crypto
      .createHash("sha256")
      .update(req.file.buffer)
      .digest("hex");

    /* -------- Metadata (immutable) -------- */
    const metadata = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadTime: new Date().toISOString(),
      platform: req.body.platform || "unknown"
    };

    /* -------- STEP 4: ENCRYPT SAME BUFFER -------- */
    const keyHex = process.env.EVIDENCE_ENC_KEY;
    if (!keyHex) throw new Error("Encryption key missing");

    const key = Buffer.from(keyHex, "hex");
    if (key.length !== 32) throw new Error("Invalid encryption key");

    const { iv, encrypted, authTag } =
      encryptBuffer(req.file.buffer, key);

    /* -------- STEP 4b: ATOMIC VAULT WRITE -------- */
    const evidenceId = crypto.randomUUID();
    const finalPath = path.join(vaultDir, `${evidenceId}.bin`);
    const tempPath = finalPath + ".tmp";

    const payload = Buffer.concat([iv, authTag, encrypted]);
    fs.writeFileSync(tempPath, payload);
    fs.renameSync(tempPath, finalPath);

    /* -------- STEP 5 + PART C: HASH-CHAINED MANIFEST -------- */
    let manifest = [];
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    }

    const previousHash =
      manifest.length > 0
        ? manifest[manifest.length - 1].recordHash
        : "GENESIS";

    const record = {
      evidenceId,
      sha256,
      metadata,
      vaultFile: `${evidenceId}.bin`,
      createdAt: new Date().toISOString(),
      previousHash
    };

    const recordHash = crypto
      .createHash("sha256")
      .update(previousHash + JSON.stringify(record))
      .digest("hex");

    record.recordHash = recordHash;
    manifest.push(record);

    fs.writeFileSync(
      manifestPath,
      JSON.stringify(manifest, null, 2)
    );

    /* -------- NODE → PYTHON WORKFLOW EVENT -------- */
    fetch("http://127.0.0.1:8000/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "EVIDENCE_UPLOADED",
        evidenceId,
        metadata: {
          platform: metadata.platform,
          mimeType: metadata.mimeType,
          uploadedAt: metadata.uploadTime
        }
      })
    })
      .then(res => console.log("Python notified:", res.status))
      .catch(err =>
        console.error("Python notify failed:", err.message)
      );

    /* -------- RESPONSE -------- */
    res.json({
      message: "Evidence secured",
      evidenceId,
      sha256,
      recordHash
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
