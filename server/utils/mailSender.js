const nodemailer = require("nodemailer");

const mailSender = async (email, title, body) => {
    try{
        let transporter = nodemailer.createTransport({
            host: process.env.MAIL_HOST,    
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            }
        })

        let info = await transporter.sendMail({
            from: process.env.MAIL_USER,
            to: `${email}`,
            subject: `${title}`,
            html: `${body}`,
        })
        // Log only essential info, not full object
        console.log(`✓ Email sent to ${email} (MessageId: ${info.messageId})`);
        return info; 
    }

    catch(error){
        console.log(`✗ Email failed to ${email}: ${error.message}`);
        throw error;
    }
}

module.exports = mailSender;    