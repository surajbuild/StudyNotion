const express = require("express");
const router = express.Router();
const { contactUsController } = require("../controllers/ContactUs");
const { contactLimiter } = require("../middlewares/rateLimiters");

router.post("/contact", contactLimiter, contactUsController);

module.exports = router;
