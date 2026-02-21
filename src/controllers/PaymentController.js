const crypto = require('crypto');
const Order = require('../models/Orders');

// ============================================================
// PAYMOB HMAC VERIFICATION
// ============================================================

/**
 * Verifies the HMAC signature from Paymob's callback.
 * Paymob sends an HMAC of specific fields concatenated in a specific order.
 * 
 * Required fields (in order):
 * amount_cents, created_at, currency, error_occured, has_parent_transaction,
 * id, integration_id, is_3d_secure, is_auth, is_capture, is_refunded,
 * is_standalone_payment, is_voided, order.id, owner, pending,
 * source_data.pan, source_data.sub_type, source_data.type, success
 */
function verifyHmac(data, hmacReceived) {
    const hmacSecret = process.env.PAYMOB_HMAC_SECRET;

    if (!hmacSecret) {
        console.error('PAYMOB_HMAC_SECRET not configured in environment');
        return false;
    }

    // Extract fields in Paymob's required order
    const obj = data.obj;
    if (!obj) return false;

    const concatenatedString = [
        obj.amount_cents,
        obj.created_at,
        obj.currency,
        obj.error_occured,
        obj.has_parent_transaction,
        obj.id,
        obj.integration_id,
        obj.is_3d_secure,
        obj.is_auth,
        obj.is_capture,
        obj.is_refunded,
        obj.is_standalone_payment,
        obj.is_voided,
        obj.order?.id,
        obj.owner,
        obj.pending,
        obj.source_data?.pan,
        obj.source_data?.sub_type,
        obj.source_data?.type,
        obj.success,
    ].join('');

    const calculatedHmac = crypto
        .createHmac('sha512', hmacSecret)
        .update(concatenatedString)
        .digest('hex');

    return calculatedHmac === hmacReceived;
}

// ============================================================
// POST /payment/callback
// Paymob's webhook — called after each transaction attempt
// No auth token required (public webhook endpoint)
// ============================================================
module.exports.processCallback = async (req, res) => {
    try {
        const data = req.body;
        const hmacReceived = req.query.hmac;

        console.log('📦 Paymob callback received:', {
            transaction_id: data?.obj?.id,
            order_id: data?.obj?.order?.id,
            success: data?.obj?.success,
            amount_cents: data?.obj?.amount_cents,
        });

        // Verify HMAC signature
        if (!verifyHmac(data, hmacReceived)) {
            console.error('❌ HMAC verification failed');
            return res.status(403).json({ message: 'Invalid HMAC signature' });
        }

        console.log('✅ HMAC verified successfully');

        const obj = data.obj;
        const paymobOrderId = obj.order?.id;
        const transactionId = obj.id;
        const success = obj.success;
        const amountCents = obj.amount_cents;
        const pending = obj.pending;

        // Find the order by paymob_order_id
        const order = await Order.findOne({ 'payment.paymob_order_id': paymobOrderId });

        if (!order) {
            console.warn(`⚠️ No order found for Paymob order ID: ${paymobOrderId}`);
            // Still return 200 to acknowledge receipt (Paymob will retry otherwise)
            return res.status(200).json({ message: 'Order not found, callback acknowledged' });
        }

        // Update payment status
        if (success === true && pending === false) {
            order.payment.payment_status = 'paid';
            order.payment.paid_at = new Date();
            console.log(`✅ Payment successful for order ${order._id}`);
        } else if (pending === true) {
            order.payment.payment_status = 'pending';
            console.log(`⏳ Payment pending for order ${order._id}`);
        } else {
            order.payment.payment_status = 'failed';
            order.payment.failure_reason = obj.data?.message || 'Payment declined';
            console.log(`❌ Payment failed for order ${order._id}: ${obj.data?.message}`);
        }

        order.payment.paymob_transaction_id = transactionId;
        order.payment.amount_cents = amountCents;
        await order.save();

        // Always return 200 to Paymob to acknowledge receipt
        return res.status(200).json({ message: 'Callback processed successfully' });

    } catch (error) {
        console.error('❌ Payment callback error:', error);
        // Still return 200 to prevent Paymob from retrying
        return res.status(200).json({ message: 'Callback acknowledged with error' });
    }
};

// ============================================================
// GET /payment/verify/:transactionId
// Client-side verification endpoint — Flutter calls this after WebView
// Requires auth token
// ============================================================
module.exports.verifyTransaction = async (req, res) => {
    try {
        const { transactionId } = req.params;

        if (!transactionId) {
            return res.status(400).json({
                success: false,
                message: 'Transaction ID is required'
            });
        }

        // Look up order by transaction ID
        const order = await Order.findOne({
            'payment.paymob_transaction_id': transactionId
        });

        if (order) {
            return res.status(200).json({
                success: true,
                payment_status: order.payment.payment_status,
                order_id: order._id,
                paymob_order_id: order.payment.paymob_order_id,
            });
        }

        // If not found locally, verify directly with Paymob API
        const https = require('https');
        const paymobApiKey = process.env.PAYMOB_API_KEY;

        if (!paymobApiKey) {
            return res.status(500).json({
                success: false,
                message: 'Payment verification not configured'
            });
        }

        // Step 1: Get auth token from Paymob
        const authResponse = await fetch('https://accept.paymob.com/api/auth/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: paymobApiKey }),
        });
        const authData = await authResponse.json();

        if (!authData.token) {
            return res.status(500).json({
                success: false,
                message: 'Failed to authenticate with Paymob'
            });
        }

        // Step 2: Get transaction details
        const txnResponse = await fetch(
            `https://accept.paymob.com/api/acceptance/transactions/${transactionId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authData.token}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        const txnData = await txnResponse.json();

        return res.status(200).json({
            success: true,
            payment_status: txnData.success ? 'paid' : (txnData.pending ? 'pending' : 'failed'),
            transaction_id: txnData.id,
            amount_cents: txnData.amount_cents,
            currency: txnData.currency,
        });

    } catch (error) {
        console.error('❌ Transaction verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Verification failed',
            error: error.message
        });
    }
};

// ============================================================
// POST /payment/initiate
// Server-side payment initiation — more secure than client-side
// Keeps API key on server, returns only the payment key to client
// ============================================================
module.exports.initiatePayment = async (req, res) => {
    try {
        const { order_id, amount, currency = 'EGP', billing_data } = req.body;

        if (!order_id || !amount) {
            return res.status(400).json({
                success: false,
                message: 'order_id and amount are required'
            });
        }

        const paymobApiKey = process.env.PAYMOB_API_KEY;
        const integrationId = process.env.PAYMOB_INTEGRATION_ID;

        if (!paymobApiKey || !integrationId) {
            return res.status(500).json({
                success: false,
                message: 'Payment gateway not configured'
            });
        }

        // Step 1: Authenticate with Paymob
        const authRes = await fetch('https://accept.paymob.com/api/auth/tokens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: paymobApiKey }),
        });
        const authData = await authRes.json();

        if (!authData.token) {
            return res.status(500).json({ success: false, message: 'Paymob auth failed' });
        }

        const amountCents = Math.round(amount * 100);

        // Step 2: Create Paymob order
        const orderRes = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth_token: authData.token,
                delivery_needed: false,
                amount_cents: amountCents.toString(),
                currency: currency,
                items: [],
            }),
        });
        const paymobOrder = await orderRes.json();

        if (!paymobOrder.id) {
            return res.status(500).json({ success: false, message: 'Failed to create Paymob order' });
        }

        // Step 3: Get payment key
        const defaultBilling = {
            apartment: 'NA', email: 'customer@deliveria.app', floor: 'NA',
            first_name: 'Customer', street: 'NA', building: 'NA',
            phone_number: '+201000000000', shipping_method: 'NA',
            postal_code: 'NA', city: 'Cairo', country: 'EG',
            last_name: 'User', state: 'NA',
        };

        const paymentKeyRes = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                auth_token: authData.token,
                amount_cents: amountCents.toString(),
                expiration: 3600,
                order_id: paymobOrder.id.toString(),
                billing_data: billing_data || defaultBilling,
                currency: currency,
                integration_id: parseInt(integrationId),
            }),
        });
        const paymentKeyData = await paymentKeyRes.json();

        if (!paymentKeyData.token) {
            return res.status(500).json({ success: false, message: 'Failed to get payment key' });
        }

        // Step 4: Store Paymob order ID in our order
        await Order.findByIdAndUpdate(order_id, {
            $set: {
                'payment.paymob_order_id': paymobOrder.id,
                'payment.payment_status': 'pending',
                'payment.amount_cents': amountCents,
            }
        });

        return res.status(200).json({
            success: true,
            payment_key: paymentKeyData.token,
            paymob_order_id: paymobOrder.id,
            iframe_id: process.env.PAYMOB_IFRAME_ID || '947222',
        });

    } catch (error) {
        console.error('❌ Payment initiation error:', error);
        return res.status(500).json({
            success: false,
            message: 'Payment initiation failed',
            error: error.message,
        });
    }
};
