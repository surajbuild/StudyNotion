// Import the required modules
const express = require("express");
const router = express.Router();

const {
    capturePayment,
    verifyPayment,
    markPaymentFailed,
    sendPaymentSuccessEmail,
    enrollFreeCourse,
    getOrderHistory,
    getOrderDetails,
} = require("../controllers/Payments");
const { auth, isStudent } = require("../middlewares/auth");

router.post("/capturePayment", auth, isStudent, capturePayment);
router.post("/verifyPayment", auth, isStudent, verifyPayment);
router.post("/markPaymentFailed", auth, isStudent, markPaymentFailed);
router.post("/enrollFreeCourse", auth, isStudent, enrollFreeCourse);
router.post("/sendPaymentSuccessEmail", auth, isStudent, sendPaymentSuccessEmail);
router.get("/orders", auth, isStudent, getOrderHistory);
router.get("/orders/:orderId", auth, isStudent, getOrderDetails);

module.exports = router;
