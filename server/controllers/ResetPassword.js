const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const { resetPasswordEmail } = require("../mail/templates/resetPasswordEmail");
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { isTestMode } = require("../config/testSafety");
const { validateNewPassword } = require("../utils/passwordPolicy");
if (!isTestMode()) {
    require('dotenv').config();
}

//reset password token
exports.resetPasswordToken = async (req, res) => {
    try{
        //get email from req.body
        const email = req.body.email;
        //check user for this email, email validation
        const user = await User.findOne({email: email});
        if(!user){
            return res.status(401).json({
                success: false,
                message: 'Your email is not registered with us',
            })
        }
        //generate token
        const token = crypto.randomUUID();
        //update user by adding token and expiration time
        const updatedDetails = await User.findOneAndUpdate(
                                    {email: email},
                                    {
                                        token: token,
                                        resetPasswordExpires: Date.now() + 5*60*1000,
                                    },
                                    {new: true}
                                );
        // Determine frontend base URL: prefer requesting origin header (works in both localhost and production),
        // fallback to FRONTEND_URL env var, then localhost:3000
        let origin = req.headers?.origin;
        if (!origin && req.headers?.referer) {
            try {
                origin = new URL(req.headers.referer).origin;
            } catch (e) {
                origin = null;
            }
        }
        const frontend = origin || process.env.FRONTEND_URL || 'http://localhost:3000';
        // Frontend uses HashRouter (src/index.js), so routes must be prefixed with /#/
        const url = `${frontend.replace(/\/$/, '')}/#/update-password/${token}`;
        await mailSender(email, "Password Reset Link", resetPasswordEmail(url));
        //return response
        return res.status(200).json({ success: true, message: 'Email sent successfully, please check email and change password' });
    }
    catch(error){
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Something went wrong while sending reset password mail",
        })
    }
}
//reset password
exports.resetPassword = async (req, res) => {
    try{
        //data fetch
        const {password, confirmPassword, token} = req.body;

        // Guard missing/empty/non-string token so User.findOne({ token: null }) can never match cleared tokens
        if(!token || typeof token !== "string" || !token.trim()){
            return res.status(400).json({
                success: false,
                message: "Password reset token is required",
            });
        }

        if(!password || !confirmPassword){
            return res.status(400).json({
                success: false,
                message: "Password and confirm password are required",
            });
        }

        // Enforce consistent minimum password policy
        const passwordValidation = validateNewPassword(password);
        if(!passwordValidation.valid){
            return res.status(400).json({
                success: false,
                message: passwordValidation.message,
            });
        }

        //validation
        if(typeof confirmPassword !== "string" || password !== confirmPassword){
            return res.status(401).json({
                success: false,
                message: "Password did not match"
            });
        }

        const trimmedToken = token.trim();
        //get user details from db using token
        const userDetails = await User.findOne({token: trimmedToken});
        //if no entry - invalid token
        if(!userDetails){
            return res.status(401).json({
                success: false,
                message: "Token is invalid",
            });
        }
        //token time check
        if(!userDetails.resetPasswordExpires || userDetails.resetPasswordExpires < Date.now() ) {
            return res.status(401).json({
                success: false,
                message: "Token is expired, Please regenerate your token",
            });
        }

        //hash password and clear token fields (single-use token invalidation)
        const hashedPassword = await bcrypt.hash(password, 10);
        await User.findOneAndUpdate(
            { _id: userDetails._id, token: trimmedToken },
            { password: hashedPassword, token: null, resetPasswordExpires: null },
            { new: true }
        );

        return res.status(200).json({ success: true, message: 'Password reset successfully' });
    }
    catch(error){
        console.error(error);
        return res.status(500).json({ success: false, message: 'Something went wrong' });
    }
}
