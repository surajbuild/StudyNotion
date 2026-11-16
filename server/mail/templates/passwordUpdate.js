const { escapeHtml, renderEmail } = require("./emailLayout");

exports.passwordUpdated = (email, name) =>
    renderEmail({
        title: "Password Update Confirmation",
        heading: "Password Update Confirmation",
        body: `
            <p>Hey ${escapeHtml(name)},</p>
            <p>Your password has been successfully updated for the email
                <span class="highlight">${escapeHtml(email)}</span>.</p>
            <p>If you did not request this password change, please contact us immediately to secure your account.</p>
        `,
    });
