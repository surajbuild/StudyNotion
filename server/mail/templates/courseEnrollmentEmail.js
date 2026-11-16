const { appUrl, escapeHtml, renderEmail } = require("./emailLayout");

exports.courseEnrollmentEmail = (courseName, name) =>
    renderEmail({
        title: "Course Registration Confirmation",
        heading: "Course Registration Confirmation",
        body: `
            <p>Dear ${escapeHtml(name)},</p>
            <p>You have successfully registered for the course
                <span class="highlight">"${escapeHtml(courseName)}"</span>. We are excited to have you as a participant!</p>
            <p>Please log in to your learning dashboard to access the course materials and start your learning journey.</p>
            <a class="cta" href="${appUrl()}/dashboard">Go to Dashboard</a>
        `,
    });
