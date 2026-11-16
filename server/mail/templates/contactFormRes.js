const { escapeHtml, renderEmail } = require("./emailLayout");

exports.contactUsEmail = (
    email,
    firstname,
    lastname,
    message,
    phoneNo,
    countrycode
) =>
    renderEmail({
        title: "Contact Form Confirmation",
        heading: "Contact Form Confirmation",
        body: `
            <p>Dear ${escapeHtml(firstname)} ${escapeHtml(lastname)},</p>
            <p>Thank you for contacting us. We have received your message and will respond to you as soon as possible.</p>
            <p>Here are the details you provided:</p>
            <p>Name: ${escapeHtml(firstname)} ${escapeHtml(lastname)}</p>
            <p>Email: ${escapeHtml(email)}</p>
            <p>Phone Number: ${escapeHtml(countrycode)} ${escapeHtml(phoneNo)}</p>
            <p>Message: ${escapeHtml(message)}</p>
            <p>We appreciate your interest and will get back to you shortly.</p>
        `,
    });
