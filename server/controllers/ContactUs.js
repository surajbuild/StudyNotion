const { contactUsEmail } = require('../mail/templates/contactFormRes');
const mailSender = require('../utils/mailSender');

// Simple contact form handler with basic validation and clear status codes
exports.contactUsController = async (req, res) => {
    const { email, firstname, lastname, message, phoneNo, countrycode } = req.body;

    if (!email || !message) {
        return res.status(400).json({ success: false, message: 'Email and message are required' });
    }

    try {
        await mailSender(
            email,
            'StudyNotion - We received your message',
            contactUsEmail(email, firstname, lastname, message, phoneNo, countrycode)
        );

        console.log(`Contact form email queued for ${email}`);
        return res.status(200).json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('contactUs error:', error.message || error);
        return res.status(500).json({ success: false, message: 'Unable to send email' });
    }
};
