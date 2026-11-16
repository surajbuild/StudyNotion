const { escapeHtml, renderEmail } = require("./emailLayout");

exports.resetPasswordEmail = (url) =>
    renderEmail({
        title: "Password Reset Link",
        heading: "Password Reset Request",
        body: `
            <p>We received a request to reset your StudyNotion password.</p>
            <p>This link is valid for 5 minutes.</p>
            <a class="cta" href="${escapeHtml(url)}">Reset Password</a>
            <p>If the button does not work, copy and paste this link into your browser:</p>
            <p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
            <p>If you did not request this, you can safely ignore this email.</p>
        `,
    });
