const User = require("../models/User");
const OTP = require("../models/OTP");
const otpGenerator = require("otp-generator");
const bcrypt = require("bcrypt");
const { passwordUpdated } = require("../mail/templates/passwordUpdate");
const mailSender = require("../utils/mailSender");
const otpTemplate = require("../mail/templates/emailVerificationTemplate");
const Profile = require("../models/Profile");
const jwt = require("jsonwebtoken");

require("dotenv").config();

// ============================================================
// SIGN UP — creates a new user account after OTP verification
// ============================================================
exports.signUp = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            password,
            confirmPassword,
            accountType,
            contactNumber,
            otp,
        } = req.body;

        // Validate all required fields are present
        if (!firstName || !lastName || !email || !password || !confirmPassword || !otp) {
            return res.status(403).json({
                success: false,
                message: "All fields are required",
            });
        }

        // Passwords must match
        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Password and Confirm Password do not match",
            });
        }

        // Prevent duplicate accounts
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User is already registered. Please sign in to continue",
            });
        }

        // Find the most recently created OTP for this email
        const recentOtp = await OTP.find({ email }).sort({ createdAt: -1 }).limit(1);

        if (recentOtp.length === 0) {
            return res.status(400).json({
                success: false,
                message: "OTP not found. Please request a new one.",
            });
        }

        // Second-layer expiry check — MongoDB TTL deletes OTPs after 5 min but
        // the TTL monitor runs every ~60s, so a just-expired OTP can still exist
        // in the DB for up to a minute. This check closes that window.
        const OTP_EXPIRY_MS = 5 * 60 * 1000;
        if (Date.now() - new Date(recentOtp[0].createdAt).getTime() > OTP_EXPIRY_MS) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired. Please request a new one.",
            });
        }

        // Compare trimmed strings to avoid whitespace mismatches
        if (String(otp).trim() !== String(recentOtp[0].otp).trim()) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP. Please try again.",
            });
        }

        // Hash the password before storing (bcrypt salt rounds = 10)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Instructors require admin approval; students are auto-approved
        const approved = accountType !== "Instructor";

        // Create a blank additional-details profile for the new user
        const profileDetails = await Profile.create({
            gender: null,
            dateOfBirth: null,
            about: null,
            contactNumber: null,
        });

        const user = await User.create({
            firstName,
            lastName,
            email,
            contactNumber,
            password: hashedPassword,
            accountType,
            approved,
            additionalDetails: profileDetails._id,
            // Generate an avatar from the user's initials as a default profile picture
            image: `https://api.dicebear.com/9.x/initials/svg?seed=${firstName} ${lastName}`,
        });

        // Strip password before sending response — never return hashed passwords
        // to the client, even accidentally
        user.password = undefined;

        return res.status(200).json({
            success: true,
            user,
            message: "User registered successfully",
        });
    } catch (error) {
        console.error("signUp error:", error);
        return res.status(500).json({
            success: false,
            message: "Registration failed. Please try again.",
        });
    }
};

// ============================================================
// LOGIN — authenticates and returns a signed JWT
// ============================================================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        // Populate additionalDetails so the client gets a complete user object
        const user = await User.findOne({ email }).populate("additionalDetails");

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not registered. Please sign up first.",
            });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Password is incorrect",
            });
        }

        // Build JWT payload (email, id, role — no sensitive data)
        const payload = {
            email: user.email,
            id: user._id,
            accountType: user.accountType,
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: "24h",
        });

        // Attach token to the user object for the response, but strip the password
        user.token = token;
        user.password = undefined;

        // Set an httpOnly cookie as a secondary authentication mechanism
        const cookieOptions = {
            expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            httpOnly: true,
        };

        res.cookie("token", token, cookieOptions).status(200).json({
            success: true,
            token,
            user,
            message: "Logged in successfully",
        });
    } catch (error) {
        console.error("login error:", error);
        return res.status(500).json({
            success: false,
            message: "Login failed. Please try again.",
        });
    }
};

// ============================================================
// SEND OTP — generates and stores a 6-digit OTP for email verification
// ============================================================
exports.sendOTP = async (req, res) => {
    try {
        const { email } = req.body;

        // Reject if the email is already taken
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(401).json({
                success: false,
                message: "User already registered",
            });
        }

        // Generate a numeric-only OTP
        let otp = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false,
        });

        // Keep regenerating until we get a unique OTP 
        let collision = await OTP.findOne({ otp });
        while (collision) {
            otp = otpGenerator.generate(6, {
                upperCaseAlphabets: false,
                lowerCaseAlphabets: false,
                specialChars: false,
            });
            collision = await OTP.findOne({ otp });
        }

        await OTP.create({ email, otp });

        // Send the OTP email using Resend
        let emailDelivered = false;
        try {
            await mailSender(
                email,
                "StudyNotion – Your OTP Verification Code",
                otpTemplate(otp)
            );
            emailDelivered = true;
        } catch (mailErr) {
            console.error(`⚠️ Could not deliver OTP email to ${email}: ${mailErr.message}`);
            console.log(`\n========================================\n🔐 DEV OTP for ${email}: [ ${otp} ]\n========================================\n`);
        }

        return res.status(200).json({
            success: true,
            data: otp,
            emailDelivered,
            message: emailDelivered 
                ? "OTP sent successfully to your email" 
                : "OTP generated (check server console if testing domain blocked email)",
        });
    } catch (error) {
        console.error("sendOTP error:", error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================================
// CHANGE PASSWORD — updates password for an authenticated user
// ============================================================
exports.changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword, confirmNewPassword } = req.body;

        // The auth middleware attaches the decoded JWT payload to req.user
        const userId = req.user?.id || req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!oldPassword || !newPassword || !confirmNewPassword) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        if (newPassword !== confirmNewPassword) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password do not match",
            });
        }

        // Prevent users from "changing" to the same password
        if (oldPassword === newPassword) {
            return res.status(400).json({
                success: false,
                message: "New password must be different from the old password",
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Old password is incorrect",
            });
        }

        // Hash and store the new password
        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        // Send a security-notification email (best-effort — does not fail the request)
        try {
            await mailSender(
                user.email,
                "Password Changed – StudyNotion",
                passwordUpdated(user.email, user.firstName)
            );
        } catch (mailErr) {
            console.error("Password-change notification email failed:", mailErr.message);
        }

        return res.status(200).json({
            success: true,
            message: "Password updated successfully",
        });
    } catch (error) {
        console.error("changePassword error:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to update password. Please try again.",
        });
    }
};
