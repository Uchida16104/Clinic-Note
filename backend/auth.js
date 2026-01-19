const express = require("express");
const router = express.Router();

const BASIC_USER = process.env.BASIC_USER;
const BASIC_PASSWORD = process.env.BASIC_PASSWORD;

router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false });
  }

  if (username === BASIC_USER && password === BASIC_PASSWORD) {
    return res.json({
      success: true,
      token: "dummy-basic-token"
    });
  }

  return res.status(401).json({ success: false });
});

module.exports = router;
