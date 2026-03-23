const nodemailer = require('nodemailer');

function isTrue(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    return String(value).toLowerCase() === 'true';
}

function getSmtpTransport() {
	const host = process.env.SMTP_HOST;
	const port = Number(process.env.SMTP_PORT || 587);
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;

	if (!host || !user || !pass) {
		throw new Error('SMTP configuration is missing. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS.');
	}

	const secure = port === 465;
	const forceIpv4 = isTrue(process.env.SMTP_FORCE_IPV4, true);

	return nodemailer.createTransport({
		host,
		port,
		secure,
		family: forceIpv4 ? 4 : undefined,
		auth: {
			user,
			pass
		}
	});
}

exports.sendStaffVerificationEmail = async ({ to, username, verificationUrl, expiresHours = 24 }) => {
	const transporter = getSmtpTransport();
	const from = process.env.SMTP_FROM || process.env.SMTP_USER;
	const appName = process.env.APP_NAME || 'uKonek Plus';

	const subject = `${appName}: Verify your staff registration email`;
	const text = [
		`Hello ${username},`,
		'',
		`Thanks for registering at ${appName}.`,
		`Please verify your email by opening this link (valid for ${expiresHours} hours):`,
		verificationUrl,
		'',
		'After verification, an administrator will review and approve your account.',
		'',
		'If you did not request this, you can ignore this message.'
	].join('\n');

	const html = `
		<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
			<p>Hello <strong>${username}</strong>,</p>
			<p>Thanks for registering at <strong>${appName}</strong>.</p>
			<p>Please verify your email by clicking the button below. This link is valid for ${expiresHours} hours.</p>
			<p>
				<a
					href="${verificationUrl}"
					style="display: inline-block; background: #1d4ed8; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 6px;"
				>
					Verify Email
				</a>
			</p>
			<p>If the button does not work, copy and paste this URL into your browser:</p>
			<p><a href="${verificationUrl}">${verificationUrl}</a></p>
			<p>After verification, an administrator will review and approve your account.</p>
			<p>If you did not request this, you can ignore this message.</p>
		</div>
	`;

	await transporter.sendMail({
		from,
		to,
		subject,
		text,
		html
	});
};

exports.sendStaffRegistrationOtpEmail = async ({ to, firstName, otp, expiresMinutes = 10 }) => {
	const transporter = getSmtpTransport();
	const from = process.env.SMTP_FROM || process.env.SMTP_USER;
	const appName = process.env.APP_NAME || 'uKonek Plus';
	const safeName = String(firstName || '').trim() || 'Staff Member';

	const subject = `${appName}: Your staff registration OTP`;
	const text = [
		`Hello ${safeName},`,
		'',
		`Your one-time passcode for staff registration is: ${otp}`,
		`This code expires in ${expiresMinutes} minutes.`,
		'',
		'If you did not request this, you can ignore this message.'
	].join('\n');

	const html = `
		<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
			<p>Hello <strong>${safeName}</strong>,</p>
			<p>Your one-time passcode for staff registration is:</p>
			<p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 10px 0;">${otp}</p>
			<p>This code expires in ${expiresMinutes} minutes.</p>
			<p>If you did not request this, you can ignore this message.</p>
		</div>
	`;

	await transporter.sendMail({
		from,
		to,
		subject,
		text,
		html
	});
};

exports.sendStaffApprovalEmail = async ({ to, username, role }) => {
	const transporter = getSmtpTransport();
	const from = process.env.SMTP_FROM || process.env.SMTP_USER;
	const appName = process.env.APP_NAME || 'uKonek Plus';
	const backendBaseUrl = process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
	const loginUrl = process.env.FRONTEND_LOGIN_URL || `${backendBaseUrl}/html/index.html`;

	const subject = `${appName}: Your staff account has been approved`;
	const text = [
		`Hello ${username},`,
		'',
		'Good news. Your staff account has been approved by the administrator.',
		`Role: ${role || 'staff'}`,
		'',
		`You can now sign in here: ${loginUrl}`,
		'',
		`Thank you,`,
		`${appName} Team`
	].join('\n');

	const html = `
		<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
			<p>Hello <strong>${username}</strong>,</p>
			<p>Good news. Your staff account has been approved by the administrator.</p>
			<p><strong>Role:</strong> ${role || 'staff'}</p>
			<p>
				<a
					href="${loginUrl}"
					style="display: inline-block; background: #16a34a; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 6px;"
				>
					Go to Login
				</a>
			</p>
			<p>If the button does not work, copy and paste this URL into your browser:</p>
			<p><a href="${loginUrl}">${loginUrl}</a></p>
			<p>Thank you,<br/>${appName} Team</p>
		</div>
	`;

	await transporter.sendMail({
		from,
		to,
		subject,
		text,
		html
	});
};

exports.sendStaffPasswordResetEmail = async ({ to, username, otp, expiresMinutes = 10 }) => {
	const transporter = getSmtpTransport();
	const from = process.env.SMTP_FROM || process.env.SMTP_USER;
	const appName = process.env.APP_NAME || 'uKonek Plus';

	const subject = `${appName}: Your password reset OTP`;
	const text = [
		`Hello ${username},`,
		'',
		`We received a request to reset your password for ${appName}.`,
		`Your one-time passcode is: ${otp}`,
		`This code is valid for ${expiresMinutes} minutes.`,
		'',
		'If you did not request this, you can ignore this email.'
	].join('\n');

	const html = `
		<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
			<p>Hello <strong>${username}</strong>,</p>
			<p>We received a request to reset your password for <strong>${appName}</strong>.</p>
			<p>Your one-time passcode is:</p>
			<p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 10px 0;">${otp}</p>
			<p>This code is valid for ${expiresMinutes} minutes.</p>
			<p>If you did not request this, you can ignore this email.</p>
		</div>
	`;

	await transporter.sendMail({
		from,
		to,
		subject,
		text,
		html
	});
};

exports.sendPatientOtpEmail = async ({ to, purpose, otp, expiresMinutes = 10 }) => {
	const transporter = getSmtpTransport();
	const from = process.env.SMTP_FROM || process.env.SMTP_USER;
	const appName = process.env.APP_NAME || 'uKonek Plus';
	const friendlyPurpose = purpose === 'registration' ? 'account registration' : 'password reset';

	const subject = `${appName}: Your OTP code`;
	const text = [
		`Your one-time passcode for ${friendlyPurpose} is: ${otp}`,
		'',
		`This code expires in ${expiresMinutes} minutes.`,
		'If you did not request this, you can ignore this message.'
	].join('\n');

	const html = `
		<div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
			<p>Your one-time passcode for <strong>${friendlyPurpose}</strong> is:</p>
			<p style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 10px 0;">${otp}</p>
			<p>This code expires in ${expiresMinutes} minutes.</p>
			<p>If you did not request this, you can ignore this message.</p>
		</div>
	`;

	await transporter.sendMail({
		from,
		to,
		subject,
		text,
		html
	});
};
