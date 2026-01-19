const express = require("express");
const cors = require("cors");

const authRouter = require("./auth");
const analyticsRouter = require("./analytics");

const app = express();

app.use(cors({
  origin: "https://clinic-note-liart.vercel.app",
  credentials: true
}));

app.use(express.json());

app.use("/auth", authRouter);
app.use("/analytics", analyticsRouter);

app.get("/", (_, res) => {
  res.send("Clinic Note API is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
