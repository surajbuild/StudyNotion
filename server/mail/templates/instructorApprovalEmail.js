const { appUrl, escapeHtml, renderEmail } = require("./emailLayout");

exports.instructorApplicationReceivedEmail = (firstName = "Instructor") => {
    const safeName = escapeHtml(firstName);
    const dashboardUrl = `${appUrl()}/#/dashboard/instructor`;

    return renderEmail({
        title: "Instructor Application Received — StudyNotion",
        heading: "Instructor Application Received",
        body: `
            <p>Dear <span class="highlight">${safeName}</span>,</p>
            <p>Thank you for registering as an instructor on <span class="highlight">StudyNotion</span>.</p>
            <p>Your instructor application is currently <strong>pending administrator review</strong>. Once an administrator approves your account, you will unlock full access to course creation, content publishing, and instructor analytics.</p>
            <p>In the meantime, you can sign in to complete your profile and track your approval status.</p>
            <a class="cta" href="${dashboardUrl}">Check Account Status</a>
        `,
    });
};

exports.instructorApprovedEmail = (firstName = "Instructor") => {
    const safeName = escapeHtml(firstName);
    const dashboardUrl = `${appUrl()}/#/dashboard/instructor`;

    return renderEmail({
        title: "Instructor Account Approved — StudyNotion",
        heading: "Your Instructor Account is Approved!",
        body: `
            <p>Dear <span class="highlight">${safeName}</span>,</p>
            <p>Great news! Your instructor application on <span class="highlight">StudyNotion</span> has been <strong>approved</strong>.</p>
            <p>You now have full access to create, edit, and publish courses, upload lessons, and monitor your instructor analytics dashboard.</p>
            <a class="cta" href="${dashboardUrl}">Go to Instructor Dashboard</a>
        `,
    });
};

exports.instructorRejectedEmail = (firstName = "Instructor", reason = "") => {
    const safeName = escapeHtml(firstName);
    const trimmedReason = typeof reason === "string" ? reason.trim() : "";
    const reasonBlock = trimmedReason
        ? `<p><strong>Reviewer Note:</strong> ${escapeHtml(trimmedReason)}</p>`
        : "";
    const contactUrl = `${appUrl()}/#/contact`;

    return renderEmail({
        title: "Instructor Application Update — StudyNotion",
        heading: "Instructor Application Status Update",
        body: `
            <p>Dear <span class="highlight">${safeName}</span>,</p>
            <p>Thank you for your interest in teaching on <span class="highlight">StudyNotion</span>.</p>
            <p>After reviewing your application, we are unable to approve your instructor account at this time.</p>
            ${reasonBlock}
            <p>If you believe this decision was made in error or would like further clarification, please reach out to our support team.</p>
            <a class="cta" href="${contactUrl}">Contact Support</a>
        `,
    });
};
