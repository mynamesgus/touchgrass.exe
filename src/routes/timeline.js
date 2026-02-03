const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

const manifestPath = path.join(
  __dirname,
  "../../records/evidence-manifest.json"
);

/* =========================
   GET /api/timeline
   ========================= */
router.get("/timeline", (req, res) => {
  try {
    if (!fs.existsSync(manifestPath)) {
      return res.json({ timeline: [] });
    }

    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    );

    // Sort chronologically
    const timeline = manifest
      .slice() // do not mutate original
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

    res.json({ timeline });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
