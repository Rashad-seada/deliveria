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

module.exports.sendNotification = async (ids, sender_id, message) => {
    try {
        for (let i = 0; i < ids.length; i++) {
            let notification = new Notification({
                user_id: ids[i],
                sender_id: sender_id,
                message: message.trim(),
                seen: false
            })

            await notification.save()
            await sendFirebaseNotifyRequest(ids[i], message.trim());
        }
    } catch (error) {
        console.log(error)
        return false
    }
}

async function sendFirebaseNotifyRequest(id, body) {
    const admin = require('firebase-admin');

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.projectId,
                clientEmail: process.env.clientEmail,
                privateKey: process.env.privateKey.replace(/\\n/g, '\n'),
            }),
        });
    }

    const messaging = admin.messaging();
    const tokenholder = await FBtoken.findOne({ id: id });
    if (!tokenholder) {
        return false;
    }
    const token = tokenholder.FBtoken;

    if (token) {

        const message = {
            notification: {
                title: "Dliveria",
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
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }else{
        return false;
    }
}

module.exports.registertoken = async (id, FBtokenText) => {
    try {
        const tokenexists = await FBtoken.userHasToken(id)
        if (!tokenexists) {
            const newtoken = new FBtoken({
                id: id, FBtoken: FBtokenText
            })
            newtoken.save().then(response => {
                return true
            })
        }
        else {
            const tokenmatches = await FBtoken.userTokenMatches(
                id, FBtokenText
            )
            if (tokenmatches) {
                return true
            }
            else {
                FBtoken.findOneAndUpdate({ id: id }, { FBtoken: FBtokenText }, { new: true }).then(response => {
                    return true
                })
            }
        }
    } catch (error) {
        console.log(error)
        return false
    }

};