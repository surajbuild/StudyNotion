const Razorpay = require("razorpay");
const { isExternalMockMode } = require("../config/testSafety");

const createRazorpayClient = () => {
    if (isExternalMockMode()) {
        let counter = 1;
        return {
            orders: {
                create: async (options) => ({
                    id: `order_test_${Date.now()}_${counter++}`,
                    entity: "order",
                    amount: options.amount,
                    currency: options.currency || "INR",
                    receipt: options.receipt || `rcpt_${Date.now()}`,
                    status: "created",
                    mocked: true,
                }),
            },
        };
    }

    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY || "rzp_test_placeholder",
        key_secret: process.env.RAZORPAY_SECRET || "rzp_secret_placeholder",
    });
};

exports.instance = createRazorpayClient();
