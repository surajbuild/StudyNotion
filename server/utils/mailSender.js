const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

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

const getTransportConfig = () => {
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
    // console.log("email:" ,email)
    const transporter = nodemailer.createTransport(getTransportConfig());
    const from = process.env.MAIL_FROM || process.env.MAIL_USER?.trim();
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

    console.log(`Email sent to ${email} (ID: ${info.messageId})`);
    return info;
};

module.exports = mailSender;
