const appUrl = () =>
    (process.env.FRONTEND_URL || "https://studynotion-edtech-project.vercel.app").replace(/\/$/, "");

const logoUrl = () => process.env.EMAIL_LOGO_URL || "cid:studynotion-logo";

const supportEmail = () => process.env.SUPPORT_EMAIL || "info@studynotion.com";

const escapeHtml = (value = "") =>
    String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const baseStyles = `
    body {
        background-color: #ffffff;
        font-family: Arial, sans-serif;
        font-size: 16px;
        line-height: 1.4;
        color: #333333;
        margin: 0;
        padding: 0;
    }

    .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
        text-align: center;
    }

    .logo {
        max-width: 200px;
        width: 200px;
        height: auto;
        margin-bottom: 20px;
    }

    .message {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 20px;
    }

    .body {
        font-size: 16px;
        margin-bottom: 20px;
    }

    .cta {
        display: inline-block;
        padding: 10px 20px;
        background-color: #FFD60A;
        color: #000000;
        text-decoration: none;
        border-radius: 5px;
        font-size: 16px;
        font-weight: bold;
        margin-top: 20px;
    }

    .support {
        font-size: 14px;
        color: #666666;
        margin-top: 20px;
    }

    .highlight {
        font-weight: bold;
    }
`;

const renderEmail = ({ title, heading, body }) => {
    const siteUrl = appUrl();
    const contact = supportEmail();

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${escapeHtml(title)}</title>
    <style>${baseStyles}</style>
</head>
<body>
    <div class="container">
        <a href="${siteUrl}">
            <img class="logo" src="${logoUrl()}" width="200" alt="StudyNotion Logo">
        </a>
        <div class="message">${escapeHtml(heading)}</div>
        <div class="body">${body}</div>
        <div class="support">
            If you have any questions or need assistance, please reach out to us at
            <a href="mailto:${contact}">${contact}</a>. We are here to help.
        </div>
    </div>
</body>
</html>`;
};

module.exports = {
    appUrl,
    escapeHtml,
    renderEmail,
};
