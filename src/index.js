require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());
const uploadRoute  = require("./routes/upload");
app.use("/api",uploadRoute);

app.get("/", (req, res) => {
  res.json({ status: "Forensic backend running" });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
const timelineRoute = require("./routes/timeline");
app.use("/api", timelineRoute);
const exportRoute = require("./routes/export");
app.use("/api", exportRoute);

const decryptRoute = require("./routes/decrypt");
app.use("/api", decryptRoute);
