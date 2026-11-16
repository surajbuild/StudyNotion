const { escapeHtml, renderEmail } = require("./emailLayout");

exports.paymentSuccessEmail = (name, amount, orderId, paymentId) =>
    renderEmail({
        title: "Payment Confirmation",
        heading: "Course Payment Confirmation",
        body: `
            <p>Dear ${escapeHtml(name)},</p>
            <p>We have received a payment of <span class="highlight">Rs. ${escapeHtml(amount)}</span>.</p>
            <p>Your Payment ID is <b>${escapeHtml(paymentId)}</b></p>
            <p>Your Order ID is <b>${escapeHtml(orderId)}</b></p>
        `,
    });
