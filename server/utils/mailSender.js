const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const { isExternalMockMode } = require("../config/testSafety");

const sentTestEmails = [];

const inlineLogoCid = "studynotion-logo";
const inlineLogoPath = path.join(__dirname, "../../public/studynotion-logo.png");

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

/**
 * Builds transporter configuration supporting SMTP, Gmail, Resend SMTP, SendGrid SMTP, and AWS SES.
 */
const getTransportConfig = () => {
    const provider = (process.env.MAIL_PROVIDER || "smtp").toLowerCase().trim();

    if (provider === "sendgrid") {
        const apiKey = process.env.SENDGRID_API_KEY || process.env.MAIL_PASS;
        if (!apiKey) throw new Error("Missing SENDGRID_API_KEY environment variable");
        return {
            host: "smtp.sendgrid.net",
            port: 587,
            secure: false,
            auth: {
                user: "apikey",
                pass: apiKey.replace(/\s/g, ""),
            },
        };
    }

    if (provider === "resend") {
        const apiKey = process.env.RESEND_API_KEY || process.env.MAIL_PASS;
        if (!apiKey) throw new Error("Missing RESEND_API_KEY environment variable");
        return {
            host: "smtp.resend.com",
            port: 465,
            secure: true,
            auth: {
                user: "resend",
                pass: apiKey.replace(/\s/g, ""),
            },
        };
    }

    // Standard SMTP / Gmail SMTP
    const host = (process.env.MAIL_HOST || "smtp.gmail.com").trim();
    const port = Number((process.env.MAIL_PORT || "465").trim());
    const secure = process.env.MAIL_SECURE
        ? process.env.MAIL_SECURE.trim() === "true"
        : port === 465;
    const user = process.env.MAIL_USER?.trim();
    const pass = process.env.MAIL_PASS?.replace(/\s/g, "");

    if (!user || !pass) {
        throw new Error("Missing MAIL_USER or MAIL_PASS environment variables");
    }

    return {
        host,
        port,
        secure,
        auth: {
            user,
            pass,
        },
    };
};

const mailSender = async (email, title, body) => {
    if (isExternalMockMode()) {
        const mockMessageId = `test-mock-mail-${Date.now()}-${sentTestEmails.length + 1}`;
        sentTestEmails.push({
            to: email,
            subject: title,
            html: body,
            text: htmlToText(body),
            messageId: mockMessageId,
            sentAt: new Date().toISOString(),
        });
        return { messageId: mockMessageId, mocked: true };
    }

    const transporter = nodemailer.createTransport(getTransportConfig());
    const from = process.env.MAIL_FROM || process.env.MAIL_USER?.trim() || "no-reply@studynotion.com";
    const attachments = [];

    if (body.includes(`cid:${inlineLogoCid}`) && fs.existsSync(inlineLogoPath)) {
        attachments.push({
            filename: "studynotion-logo.png",
            path: inlineLogoPath,
            cid: inlineLogoCid,
        });
    }

    const info = await transporter.sendMail({
        from,
        to: email,
        subject: title,
        html: body,
        text: htmlToText(body),
        attachments,
    });

    console.log(`[MailSender] Email dispatched to ${email} (MessageID: ${info.messageId})`);
    return info;
};

mailSender.getSentEmails = () => [...sentTestEmails];
mailSender.clearSentEmails = () => {
    sentTestEmails.length = 0;
};

module.exports = mailSender;
