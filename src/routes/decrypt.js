const express = require("express");
const fs = require("fs");
const path = require("path");
const { decryptBuffer } = require("../crypto/decrypt");

const router = express.Router();

const vaultDir = path.join(__dirname, "../../vault");

router.get("/evidence/:id/decrypt", (req, res) => {
  try {
    const evidenceId = req.params.id;
    const vaultFile = path.join(vaultDir, `${evidenceId}.bin`);

    if (!fs.existsSync(vaultFile)) {
      return res.status(404).json({ error: "Evidence not found" });
    }

    const payload = fs.readFileSync(vaultFile);
    const key = Buffer.from(process.env.EVIDENCE_ENC_KEY, "hex");

    const plaintext = decryptBuffer(payload, key);

    // Stream directly, no disk write
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=${evidenceId}`
    );

    res.send(plaintext);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
