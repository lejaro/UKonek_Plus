const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create reusable transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

/**
 * Generates a random verification token.
 * @returns {string} 64-char hex token
 */
exports.generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Sends a verification email to the given address.
 * @param {string} to - Recipient email
 * @param {string} token - Verification token
 * @returns {Promise}
 */
exports.sendVerificationEmail = async (to, token) => {
    const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;
    const verifyUrl = `${baseUrl}/api/staff/verify-email?token=${encodeURIComponent(token)}`;

    const mailOptions = {
        from: `"U-Konek+" <${process.env.SMTP_USER}>`,
        to,
        subject: 'U-Konek+ — Verify Your Email Address',
        html: `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 30px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #00277F; font-size: 28px; margin: 0;">U-Konek<span style="color: #D0504F;">+</span></h1>
                </div>
                <h2 style="color: #1e293b; font-size: 20px; text-align: center;">Verify Your Email Address</h2>
                <p style="color: #64748b; font-size: 14px; line-height: 1.6; text-align: center;">
                    Thank you for registering with U-Konek+. Please click the button below to verify your email address and complete your registration.
                </p>
                <div style="text-align: center; margin: 28px 0;">
                    <a href="${verifyUrl}" style="display: inline-block; background: #00277F; color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 700; font-size: 14px;">
                        Verify Email
                    </a>
                </div>
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                    This link will expire in 24 hours. If you did not create an account, please ignore this email.
                </p>
            </div>
        `,
    };

    return transporter.sendMail(mailOptions);
};
