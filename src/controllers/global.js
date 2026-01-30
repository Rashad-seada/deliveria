const FBtoken = require("../models/FBtoken");
const https = require('https');
const Notification = require("../models/Notifications");

module.exports = {
    not_select: [
        '-user_name',
        '-password',
        '-rate_number',
        '-user_rated'
    ],
};

module.exports.checkIsOpen = (open_hour, close_hour) => {
    const now = new Date();
    now.setHours(now.getHours() + 3);
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Parse opening and closing times (format "HH:MM")
    const [openHour, openMinute] = open_hour.split(':').map(Number);
    const [closeHour, closeMinute] = close_hour.split(':').map(Number);

    const openTimeInMinutes = openHour * 60 + openMinute;
    const closeTimeInMinutes = closeHour * 60 + closeMinute;

    // Determine if the restaurant is currently open
    let is_open;

    if (openTimeInMinutes < closeTimeInMinutes) {
        // Normal case: open and close on the same day
        is_open = currentTimeInMinutes >= openTimeInMinutes &&
            currentTimeInMinutes <= closeTimeInMinutes;
    } else {
        // Overnight case: closes the next day (e.g., open at 20:00, closes at 03:00)
        is_open = currentTimeInMinutes >= openTimeInMinutes ||
            currentTimeInMinutes <= closeTimeInMinutes;
    }

    return is_open;
}

module.exports.sendNotification = async (ids, sender_id, message, title = "Deliveria") => {
    console.log(`[DEBUG Notification] Request to send notification to ${ids.length} users. Title: "${title}", Message: "${message}"`);
    // Process all notifications in parallel so one failure doesn't stop the rest
    const promises = ids.map(async (id) => {
        try {
            if (!id) {
                console.warn('[DEBUG Notification] Skipped empty user ID');
                return;
            }

            console.log(`[DEBUG Notification] Processing user ID: ${id}`);
            let notification = new Notification({
                user_id: id,
                sender_id: sender_id,
                message: message.trim(),
                title: title.trim(),
                seen: false
            });

            await notification.save();
            console.log(`[DEBUG Notification] Saved to DB for user ${id}. Now sending to Firebase...`);

            const firebaseResult = await sendFirebaseNotifyRequest(id, message.trim(), title.trim());
            console.log(`[DEBUG Notification] Firebase result for user ${id}: ${firebaseResult ? 'SUCCESS' : 'FAILED'}`);
        } catch (error) {
            console.error(`[DEBUG Notification] ERROR sending to user ${id}:`, error);
            // Continue processing other users
        }
    });

    await Promise.allSettled(promises);
    console.log('[DEBUG Notification] Finished processing all recipients.');
}

async function sendFirebaseNotifyRequest(id, body, title = "Deliveria") {
    const admin = require('firebase-admin');

    if (!admin.apps.length) {
        console.log('[DEBUG Firebase] Initializing Firebase Admin SDK...');
        console.log(`[DEBUG Firebase] projectId: ${process.env.projectId}`);
        console.log(`[DEBUG Firebase] clientEmail: ${process.env.clientEmail}`);

        const rawKey = process.env.privateKey;
        if (rawKey) {
            console.log(`[DEBUG Firebase] privateKey length: ${rawKey.length}`);
            console.log(`[DEBUG Firebase] privateKey start: ${rawKey.substring(0, 30)}...`);
            // Check for literal \n characters vs real newlines
            console.log(`[DEBUG Firebase] privateKey includes literal \\n: ${rawKey.includes('\\n')}`);
        } else {
            console.error('[DEBUG Firebase] privateKey is MISSING!');
        }

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.projectId,
                clientEmail: process.env.clientEmail,
                privateKey: process.env.privateKey ? process.env.privateKey.replace(/\\n/g, '\n') : undefined,
            }),
        });
    }

    const messaging = admin.messaging();
    const tokenholder = await FBtoken.findOne({ id: id });
    if (!tokenholder) {
        console.warn(`[DEBUG Firebase] No FCM token found for user ID: ${id}`);
        return false;
    }
    const token = tokenholder.FBtoken;
    console.log(`[DEBUG Firebase] Found token for user ${id}: ${token.substring(0, 10)}...`);

    if (token) {

        const message = {
            notification: {
                title: title,
                body: body,
            },
            android: {
                priority: "high",
            },
            data: {
                click_action: "FLUTTER_NOTIFICATION_CLICK",
            },
            token: token,
        };

        try {
            const response = await messaging.send(message);
            console.log(`[DEBUG Firebase] Successfully sent message to ${id}. Response: ${response}`);
            return true;
        } catch (error) {
            console.error(`[DEBUG Firebase] Error sending to ${id}:`, error);
            return false;
        }
    } else {
        return false;
    }
}

module.exports.registertoken = async (id, FBtokenText) => {
    try {
        console.log(`[DEBUG TokenRegister] Attempting to register token for user ${id}`);
        // Log the token safely (first 10 chars)
        const safeToken = FBtokenText ? FBtokenText.substring(0, 10) + '...' : 'NULL';
        console.log(`[DEBUG TokenRegister] Token: ${safeToken}`);

        const tokenexists = await FBtoken.userHasToken(id)
        if (!tokenexists) {
            console.log(`[DEBUG TokenRegister] New user/token. Saving...`);
            const newtoken = new FBtoken({
                id: id, FBtoken: FBtokenText
            })
            // Use await instead of .then for cleaner logging
            await newtoken.save();
            console.log(`[DEBUG TokenRegister] Token SAVED successfully.`);
            return true;
        }
        else {
            const tokenmatches = await FBtoken.userTokenMatches(
                id, FBtokenText
            )
            if (tokenmatches) {
                console.log(`[DEBUG TokenRegister] Token already matches. No update needed.`);
                return true
            }
            else {
                console.log(`[DEBUG TokenRegister] Updating existing user with NEW token...`);
                await FBtoken.findOneAndUpdate({ id: id }, { FBtoken: FBtokenText }, { new: true });
                console.log(`[DEBUG TokenRegister] Token UPDATED successfully.`);
                return true;
            }
        }
    } catch (error) {
        console.log(error)
        return false
    }

};