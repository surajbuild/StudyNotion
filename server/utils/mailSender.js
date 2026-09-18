const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Strips HTML tags to a plain-text fallback.
// Gmail sometimes blocks HTML from shared test domains (onboarding@resend.dev),
// so the text field ensures the content is always visible.
const htmlToText = (html) =>
    html
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s{2,}/g, " ")
        .trim();

const mailSender = async (email, title, body) => {
    const { data, error } = await resend.emails.send({
        from: process.env.MAIL_FROM,
        to: [email],
        subject: title,
        html: body,
        text: htmlToText(body),
    });

    if (error) {
        console.error(`✗ Email failed to ${email}:`, error);
        throw new Error(error.message || "Failed to send email");
    }

    console.log(`✓ Email sent to ${email} (ID: ${data?.id})`);
    return data;
};

module.exports = mailSender;
