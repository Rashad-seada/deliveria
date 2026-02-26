const crypto = require('crypto');
const User = require('../models/Users');

// In-memory OTP store (use Redis in production for multi-instance deployments)
// Format: { phone: { code, expiresAt, attempts, lastSent } }
const otpStore = new Map();

// Configuration
const OTP_EXPIRY_MS = 5 * 60 * 1000;  // 5 minutes
const OTP_LENGTH = 6;
const MAX_VERIFY_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between resends

/**
 * Generate a random numeric OTP code
 */
function generateOTP(length = OTP_LENGTH) {
    const digits = '0123456789';
    let otp = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        otp += digits[bytes[i] % 10];
    }
    return otp;
}

/**
 * Send OTP via BeOn REST API
 * Endpoint: POST https://v3.api.beon.chat/api/v3/messages/otp
 * Auth: beon-token header
 * Body: multipart/form-data
 * Note: BeOn generates and sends the OTP code itself.
 */
async function sendViaBeOn(phone, reference, channel = 'sms') {
    const beonApiKey = process.env.BEON_API_KEY;

    if (!beonApiKey) {
        console.error('❌ BEON_API_KEY is not set in environment variables!');
        throw new Error('BEON_API_KEY is not configured on the server.');
    }

    const beonApiUrl = 'https://v3.api.beon.chat/api/v3/messages/otp';

    // Build multipart/form-data body
    const formData = new FormData();
    formData.append('phoneNumber', phone);
    formData.append('name', 'User');     // Optional: can be customized later
    formData.append('type', channel === 'whatsapp' ? 'whatsapp' : 'sms');
    formData.append('otp_length', '6');
    formData.append('reference', reference); // Used to identify this request

    console.log(`📤 Sending OTP via BeOn (${channel}) to ${phone.replace(/.(?=.{4})/g, '*')} | ref: ${reference}`);

    const response = await fetch(beonApiUrl, {
        method: 'POST',
        headers: {
            'beon-token': beonApiKey,
        },
        body: formData,
    });

    const result = await response.json().catch(() => ({}));

    console.log(`📱 BeOn API response (${channel}) [${response.status}]:`, JSON.stringify(result));

    if (!response.ok) {
        throw new Error(`BeOn API error ${response.status}: ${result?.message || JSON.stringify(result)}`);
    }

    // BeOn returns the generated OTP code inside result (e.g. result.data.otp or result.otp)
    // Log all keys so we can find the OTP field if needed
    console.log('📦 BeOn response keys:', Object.keys(result));

    return result;
}


// ============================================================
// POST /otp/send
// Send OTP to a phone number via WhatsApp (or SMS fallback)
// Public endpoint — no auth required (used during signup)
// ============================================================
module.exports.sendOtp = async (req, res) => {
    try {
        const { phone, channel = 'whatsapp' } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required',
            });
        }

        // Normalize phone number (ensure +country code)
        const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;

        // Rate limiting: Check cooldown
        const existing = otpStore.get(normalizedPhone);
        if (existing && existing.lastSent) {
            const timeSinceLast = Date.now() - existing.lastSent;
            if (timeSinceLast < RESEND_COOLDOWN_MS) {
                const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - timeSinceLast) / 1000);
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${remainingSeconds} seconds before requesting a new OTP`,
                    retry_after: remainingSeconds,
                });
            }
        }

        // Generate a reference ID for this OTP request
        const reference = `otp_${Date.now()}`;

        // Store entry in-memory for rate limiting tracking
        // Note: BeOn generates and sends the actual OTP code
        otpStore.set(normalizedPhone, {
            reference: reference,
            expiresAt: Date.now() + OTP_EXPIRY_MS,
            attempts: 0,
            lastSent: Date.now(),
        });

        // Send via BeOn (BeOn generates and delivers the OTP code to the user)
        let sendResult;
        try {
            sendResult = await sendViaBeOn(normalizedPhone, reference, channel);
        } catch (beonError) {
            // If WhatsApp fails, try SMS as fallback
            if (channel === 'whatsapp') {
                console.log('⚠️ WhatsApp failed, falling back to SMS...');
                try {
                    sendResult = await sendViaBeOn(normalizedPhone, reference, 'sms');
                } catch (smsError) {
                    // Clean up stored OTP on send failure
                    otpStore.delete(normalizedPhone);
                    console.error('❌ Both WhatsApp and SMS failed. WhatsApp error:', beonError.message, '| SMS error:', smsError.message);
                    return res.status(500).json({
                        success: false,
                        message: 'Failed to send OTP. Please try again later.',
                        debug_hint: process.env.NODE_ENV !== 'production' ? beonError.message : undefined,
                    });
                }
            } else {
                otpStore.delete(normalizedPhone);
                console.error('❌ BeOn send failed:', beonError.message);
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send OTP. Please try again later.',
                    debug_hint: process.env.NODE_ENV !== 'production' ? beonError.message : undefined,
                });
            }
        }

        // Extract the OTP code that BeOn generated and store it for verification
        const beonOtp = sendResult?.data?.otp?.toString();
        if (beonOtp) {
            const storedEntry = otpStore.get(normalizedPhone);
            if (storedEntry) {
                storedEntry.code = beonOtp;
                console.log(`🔐 OTP code stored for verification (phone: ${normalizedPhone.replace(/.(?=.{4})/g, '*')})`);
            }
        } else {
            console.warn('⚠️ BeOn did not return an OTP code in response. Verification may fail.');
        }

        // Auto-cleanup expired OTPs periodically
        if (otpStore.size > 1000) {
            const now = Date.now();
            for (const [key, value] of otpStore) {
                if (value.expiresAt < now) otpStore.delete(key);
            }
        }

        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            phone: normalizedPhone.replace(/.(?=.{4})/g, '*'), // Mask for security
            expires_in: OTP_EXPIRY_MS / 1000,
        });

    } catch (error) {
        console.error('❌ Send OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while sending OTP',
        });
    }
};

// ============================================================
// POST /otp/verify
// Verify OTP code for a phone number
// Public endpoint — no auth required (used during signup)
// ============================================================
module.exports.verifyOtp = async (req, res) => {
    try {
        const { phone, code } = req.body;

        if (!phone || !code) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and OTP code are required',
            });
        }

        const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
        const storedOtp = otpStore.get(normalizedPhone);

        // Check if OTP exists
        if (!storedOtp) {
            return res.status(400).json({
                success: false,
                message: 'No OTP found for this number. Please request a new one.',
            });
        }

        // Check if expired
        if (Date.now() > storedOtp.expiresAt) {
            otpStore.delete(normalizedPhone);
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.',
            });
        }

        // Check max attempts
        if (storedOtp.attempts >= MAX_VERIFY_ATTEMPTS) {
            otpStore.delete(normalizedPhone);
            return res.status(429).json({
                success: false,
                message: 'Too many verification attempts. Please request a new OTP.',
            });
        }

        // Increment attempt count
        storedOtp.attempts += 1;

        // Verify the code
        if (storedOtp.code !== code.toString()) {
            const remainingAttempts = MAX_VERIFY_ATTEMPTS - storedOtp.attempts;
            return res.status(400).json({
                success: false,
                message: `Invalid OTP code. ${remainingAttempts} attempts remaining.`,
                remaining_attempts: remainingAttempts,
            });
        }

        // OTP is valid — clean up
        otpStore.delete(normalizedPhone);

        // Mark user as verified if they exist
        const user = await User.findOne({ phone: normalizedPhone.replace('+2', '') });
        if (user) {
            user.is_verified = true;
            user.verification_date = new Date();
            await user.save();
        }

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            verified: true,
        });

    } catch (error) {
        console.error('❌ Verify OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during verification',
        });
    }
};

// ============================================================
// POST /otp/resend
// Resend OTP — generates a fresh code and sends again
// Public endpoint — no auth required
// ============================================================
module.exports.resendOtp = async (req, res) => {
    try {
        const { phone, channel = 'whatsapp' } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required',
            });
        }

        // Delegate to sendOtp (it handles cooldown + new code generation)
        req.body.channel = channel;
        return module.exports.sendOtp(req, res);

    } catch (error) {
        console.error('❌ Resend OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while resending OTP',
        });
    }
};
