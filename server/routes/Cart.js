const express = require("express");
const router = express.Router();

const {
    getCart,
    addToCart,
    removeFromCart,
    syncCart,
} = require("../controllers/Cart");
const { auth, isStudent } = require("../middlewares/auth");

router.get("/", auth, isStudent, getCart);
router.post("/add", auth, isStudent, addToCart);
router.delete("/remove/:courseId", auth, isStudent, removeFromCart);
router.delete("/remove", auth, isStudent, removeFromCart);
router.post("/sync", auth, isStudent, syncCart);

module.exports = router;
