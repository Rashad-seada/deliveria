# 🔄 تحليل شامل لخطوات سير نظام التوصيل

## 📋 نظرة عامة

هذا المستند يوضح بالتفصيل كيفية سير العمل في نظام التوصيل من البداية إلى النهاية، مع شرح كل خطوة وكيفية حساب التكاليف.

---

## 🛒 المرحلة 1: إنشاء الطلب (Create Order)

### الملف: `OrdersController.js` - دالة `createOrder()`

### الخطوات:

#### 1. استلام البيانات من المستخدم
```javascript
const { address_id, payment_type } = req.body;
const userId = req.decoded.id;
```

**البيانات المطلوبة:**
- `address_id` - معرف العنوان
- `payment_type` - طريقة الدفع
- `userId` - معرف المستخدم (من التوكن)

---

#### 2. جلب بيانات العنوان
```javascript
const address = await Address.findById(address_id);
```

**البيانات المستخرجة:**
- `address.coordinates.latitude` - خط العرض
- `address.coordinates.longitude` - خط الطول
- بيانات العنوان الكاملة

---

#### 3. جلب بيانات السلة (Cart)
```javascript
const cart = await getCart(userId, address);
```

**ما يحدث داخل `getCart()`:**

##### 3.1. جلب السلة من قاعدة البيانات
```javascript
const cart = await Cart.findOne({ user_id: userId })
    .populate('carts.items.item_id', 'name description photo sizes toppings')
    .lean();
```

##### 3.2. معالجة المنتجات وحساب الأسعار
```javascript
const { enrichedCarts, finalPriceWithoutDelivery } = await processCartItems(cart);
```

**يتم حساب:**
- سعر كل منتج (مع الحجم والإضافات)
- تطبيق الكوبونات (إن وجدت)
- إجمالي السعر بدون التوصيل

##### 3.3. حساب تكلفة التوصيل
```javascript
const finalDeliveryCost = await calculateDeliveryCost(userId, cart, address);
```

**ما يحدث داخل `calculateDeliveryCost()`:**

```javascript
// 1. جلب جميع المطاعم في الطلب
const restaurantIds = [...new Set(cart.carts.map(c => c.restaurant_id.toString()))];
const restaurants = await Restaurant.find({ '_id': { $in: restaurantIds } })
    .select('coordinates');

// 2. حساب أقصى مسافة من المطاعم إلى عنوان العميل
const maxDistance = calculateMaxDistanceToRestaurants(
    restaurants,
    address.coordinates
);

// 3. تحديد نوع الطلب
const orderType = restaurants.length > 1 ? "Multi" : "Single";

// 4. حساب تكلفة التوصيل
const deliveryFee = calculateDeliveryFee(maxDistance, orderType);
```

**معادلة حساب التكلفة:**

**للطلب الواحد (Single):**
- المسافة الأساسية: 3 كم
- السعر الأساسي: 15 جنيه
- كل كم إضافي: 4 جنيه

```
إذا كانت المسافة <= 3 كم:
    التكلفة = 15 جنيه

إذا كانت المسافة > 3 كم:
    التكلفة = 15 + ((المسافة - 3) × 4)
    
مثال: مسافة 7 كم
    التكلفة = 15 + ((7 - 3) × 4) = 15 + 16 = 31 جنيه
```

**للطلبات المتعددة (Multi):**
- المسافة الأساسية: 3 كم
- السعر الأساسي: 25 جنيه
- كل كم إضافي: 5 جنيه

```
إذا كانت المسافة <= 3 كم:
    التكلفة = 25 جنيه

إذا كانت المسافة > 3 كم:
    التكلفة = 25 + ((المسافة - 3) × 5)
    
مثال: مسافة 7 كم
    التكلفة = 25 + ((7 - 3) × 5) = 25 + 20 = 45 جنيه
```

---

#### 4. تحديد نوع الطلب
```javascript
const orderType = cart.carts.length > 1 ? "Multi" : "Single";
```

**القاعدة:**
- إذا كان الطلب من مطعم واحد → `Single`
- إذا كان الطلب من أكثر من مطعم → `Multi`

---

#### 5. إنشاء الطلب في قاعدة البيانات
```javascript
const order = new Order({
    user_id: userId,
    order_type: orderType,
    address: address,
    orders: newSubOrders,
    final_price_without_delivery_cost: cart.final_price_without_delivery_cost,
    final_delivery_cost: cart.final_delivery_cost,  // ← هنا يتم حفظ تكلفة التوصيل
    final_price: cart.final_price,
    delivery_type: "Agent",
    payment_type: payment_type,
    status: "Pending Approval",
    order_id: orderId
});

await order.save();
```

**الحقول المهمة:**
- `final_delivery_cost` - تكلفة التوصيل المحسوبة من المطعم للعميل (ثابتة)
- `final_price` - السعر الإجمالي (المنتجات + التوصيل)
- `status` - الحالة الأولية: "Pending Approval"

---

#### 6. إرسال إشعار للمطاعم
```javascript
sendNotification(restaurantIds, userId, `You have a new order #${savedOrder.order_id}`);
```

---

## 🍽️ المرحلة 2: موافقة المطعم على الطلب

### الملف: `RestaurantsController.js`

### الخطوات:

#### 1. المطعم يغير حالة الطلب إلى "Ready for Delivery"
```javascript
await Order.findOneAndUpdate(
    { _id: orderId, "orders.restaurant_id": restaurantId },
    { "$set": { 
        "orders.$.status": "Ready for Delivery", 
        "status": "Ready for Delivery", 
        "order_status": "Ready for Delivery" 
    }}
);
```

**ملاحظة مهمة:**
- الآن فقط يظهر الطلب للدليفري!
- قبل هذه الخطوة، الدليفري لا يرى الطلب

---

## 🚗 المرحلة 3: الدليفري يرى الطلبات المتاحة

### الملف: `DeliveryController.js` - دالة `getAvailableOrders()`

### الخطوات:

#### 1. جلب الطلبات الجاهزة للتوصيل
```javascript
const orders = await Order.find({
    delivery_type: "Agent",
    "agent.agent_id": null,  // لم يتم تعيين دليفري بعد
    status: "Ready for Delivery"  // ← فقط الطلبات الجاهزة
}).populate('user_id').populate('orders.restaurant_id');
```

**الشروط:**
1. ✅ نوع التوصيل: Agent
2. ✅ لم يتم تعيين دليفري بعد
3. ✅ الحالة: Ready for Delivery (فقط!)

---

## ✅ المرحلة 4: الدليفري يقبل الطلب

### الملف: `DeliveryController.js` - دالة `acceptOrder()`

### الخطوات التفصيلية:

#### 1. التحقق من عدد الطلبات الحالية
```javascript
const ongoingOrders = await Order.countDocuments({
    "agent.agent_id": agentId,
    status: { $nin: ["Completed", "Canceled", "Delivered"] }
});

if (ongoingOrders >= 3) {
    return res.status(400).json({ message: "You can only have a maximum of 3 ongoing orders." });
}
```

**القاعدة:** الدليفري لا يمكنه قبول أكثر من 3 طلبات في نفس الوقت

---

#### 2. جلب بيانات الطلب
```javascript
const order = await Order.findById(orderId);
```

---

#### 3. التحقق من صلاحية الطلب
```javascript
// التحقق من أن الطلب موجود
if (!order) {
    return res.status(404).json({ message: "Order not found." });
}

// التحقق من أن الطلب لم يتم قبوله من قبل
if (order.agent && order.agent.agent_id) {
    return res.status(400).json({ message: "This order has already been accepted by another agent." });
}

// التحقق من أن الطلب جاهز للتوصيل
if (order.status !== "Ready for Delivery") {
    return res.status(400).json({ message: "This order is no longer available for acceptance." });
}
```

---

#### 4. جلب بيانات الدليفري
```javascript
const agent = await Agent.findById(agentId);
if (!agent) {
    return res.status(404).json({ message: "Agent profile not found." });
}
```

---

#### 5. حساب المسافة والتكلفة (الخطوة الأهم!)

##### 5.1. جلب بيانات المطاعم
```javascript
const restaurantIds = order.orders.map(o => o.restaurant_id);
const restaurants = await Restaurant.find({ '_id': { $in: restaurantIds } })
    .select('coordinates');
```

##### 5.2. حساب أقصى مسافة من المطاعم للعميل
```javascript
const maxDistance = calculateMaxDistanceToRestaurants(
    restaurants,
    order.address.coordinates
);
```

**ما يحدث داخل `calculateMaxDistanceToRestaurants()`:**

```javascript
let maxDistance = 0;

for (const restaurant of restaurants) {
    // حساب المسافة من كل مطعم إلى العميل
    const distance = calculateDistance(
        restaurant.coordinates.latitude,
        restaurant.coordinates.longitude,
        userAddress.latitude,
        userAddress.longitude
    );
    
    // الاحتفاظ بأقصى مسافة
    if (distance > maxDistance) {
        maxDistance = distance;
    }
}

return maxDistance;
```

**مثال عملي:**
```
الطلب يحتوي على 3 مطاعم:
- المطعم A: المسافة للعميل = 2 كم
- المطعم B: المسافة للعميل = 5 كم
- المطعم C: المسافة للعميل = 3 كم

النتيجة: maxDistance = 5 كم (أقصى مسافة)
```

##### 5.3. حساب تكلفة التوصيل
```javascript
const deliveryFee = order.final_delivery_cost || calculateDeliveryFee(maxDistance, order.order_type);
```

**المنطق:**
1. **أولاً:** استخدام `final_delivery_cost` الموجود بالفعل (المحسوب عند إنشاء الطلب)
2. **إذا لم يكن موجوداً:** احسبه من جديد بناءً على المسافة من المطاعم

**لماذا هذا مهم؟**
- ✅ التكلفة محسوبة من **المطعم للعميل** (صحيح)
- ❌ وليس من **موقع الدليفري للعميل** (خطأ)

---

#### 6. إنشاء تفاصيل التوصيل
```javascript
const deliveryDetails = {
    distance: maxDistance,              // المسافة من المطعم للعميل
    estimated_time: calculateEstimatedTime(maxDistance),  // الوقت المقدر
    delivery_fee: deliveryFee           // التكلفة الثابتة
};
```

**معادلة الوقت المقدر:**
```javascript
estimated_time = Math.ceil((distance / 30) * 60)  // بالدقائق

// مثال: مسافة 5 كم
// estimated_time = Math.ceil((5 / 30) * 60) = Math.ceil(10) = 10 دقائق
```

---

#### 7. تحديث الطلب في قاعدة البيانات
```javascript
const updatedOrder = await Order.findByIdAndUpdate(orderId, {
    $set: { 
        agent: { 
            agent_id: agentId, 
            assigned_at: new Date() 
        }, 
        status: "Accepted",
        delivery_details: deliveryDetails 
    }
}, { new: true, populate: ['user_id', 'orders.restaurant_id'] });
```

**التغييرات:**
- `agent.agent_id` - معرف الدليفري
- `agent.assigned_at` - وقت قبول الطلب
- `status` - تغيير الحالة إلى "Accepted"
- `delivery_details` - حفظ تفاصيل التوصيل

---

#### 8. إرسال إشعار للعميل
```javascript
sendNotification([updatedOrder.user_id], agentId, 
    `Your order #${orderId.slice(-4)} has been accepted by a delivery agent.`);
```

---

## 📍 المرحلة 5: تحديث موقع الدليفري

### الملف: `DeliveryController.js` - دالة `updateAgentLocation()`

### الخطوات:

#### 1. استلام الموقع الجديد
```javascript
const { latitude, longitude } = req.body;
const agentId = req.decoded?.id;
```

---

#### 2. تحديث موقع الدليفري
```javascript
agent.current_location = {
    type: 'Point',
    coordinates: [longitude, latitude]
};
await agent.save();
```

---

#### 3. جلب الطلب النشط
```javascript
const activeOrder = await Order.findOne({ 
    "agent.agent_id": agentId, 
    status: { $in: ["Accepted", "Pick up", "On the way"] } 
});
```

---

#### 4. تحديث المسافة والوقت المقدر (ديناميكياً)
```javascript
const isRealLocation = latitude !== 0 || longitude !== 0;

if (activeOrder && isRealLocation) {
    // حساب المسافة من موقع الدليفري الحالي إلى عنوان العميل
    const currentDistanceToCustomer = calculateDistance(
        latitude, longitude,
        activeOrder.address.coordinates.latitude,
        activeOrder.address.coordinates.longitude
    );

    // تحديث المسافة والوقت المقدر
    activeOrder.delivery_details.distance = currentDistanceToCustomer;
    activeOrder.delivery_details.estimated_time = calculateEstimatedTime(currentDistanceToCustomer);
    
    // ملاحظة: delivery_fee لا يتم تغييرها!
    
    await activeOrder.save();
}
```

**ملاحظة مهمة جداً:**
- ✅ `distance` يتم تحديثها → للعرض (المسافة المتبقية)
- ✅ `estimated_time` يتم تحديثه → للعرض (الوقت المتبقي)
- ❌ `delivery_fee` **لا** يتم تغييرها → تبقى ثابتة كما حُسبت عند القبول

**مثال عملي:**

```
عند قبول الطلب:
- المسافة من المطعم للعميل: 5 كم
- delivery_fee: 31 جنيه (ثابتة)
- distance: 5 كم
- estimated_time: 10 دقائق

بعد 5 دقائق (الدليفري في الطريق):
- المسافة من موقع الدليفري الحالي للعميل: 2.5 كم
- delivery_fee: 31 جنيه (لم تتغير! ✅)
- distance: 2.5 كم (تحدثت ✅)
- estimated_time: 5 دقائق (تحدث ✅)
```

---

## 🚚 المرحلة 6: تحديث حالة الطلب

### الملف: `DeliveryController.js` - دالة `updateOrderStatus()`

### الحالات المتاحة:

```
Accepted → Pick up → On the way → Delivered → Completed
```

### تسلسل الحالات المسموح به:

```javascript
const allowedTransitions = {
    "Accepted": ["Pick up", "On the way", "Delivered"],
    "Pick up": ["On the way"],
    "On the way": ["Delivered"],
    "Delivered": ["Completed"]
};
```

### الخطوات:

#### 1. عند "Pick up" (استلام الطلب من المطعم)
```javascript
if (status === "Pick up") {
    order.agent.pickup_time = new Date();
}
```

#### 2. عند "Delivered" (تسليم الطلب للعميل)
```javascript
if (status === "Delivered") {
    order.agent.delivery_time = new Date();
    order.order_status = "Delivered";
    
    // إضافة نقطة للعميل
    const user = await User.findById(order.user_id._id);
    if (user) {
        user.points = (user.points || 0) + 1;
        
        // إذا وصل لـ 5 نقاط، إرسال إشعار للأدمن
        if (user.points >= 5) {
            const admins = await Admin.find().select('_id');
            const adminIds = admins.map(admin => admin._id);
            sendNotification(adminIds, user._id, 
                `User ${user.first_name} ${user.last_name} has reached 5 points.`);
            user.points = 0; // إعادة تعيين النقاط
        }
        await user.save();
    }
}
```

---

## 📊 ملخص الحقول المهمة في Order Model

### الحقول الثابتة (لا تتغير بعد الإنشاء):

| الحقل | متى يُحسب | كيف يُحسب | هل يتغير |
|------|----------|-----------|----------|
| `final_delivery_cost` | عند إنشاء الطلب | من أقصى مسافة بين المطاعم والعميل | ❌ لا |
| `final_price_without_delivery_cost` | عند إنشاء الطلب | مجموع أسعار المنتجات | ❌ لا |
| `final_price` | عند إنشاء الطلب | المنتجات + التوصيل | ❌ لا |
| `order_type` | عند إنشاء الطلب | Single أو Multi | ❌ لا |

### الحقول الديناميكية (تتغير):

| الحقل | متى يُحسب | كيف يُحسب | هل يتغير |
|------|----------|-----------|----------|
| `delivery_details.delivery_fee` | عند قبول الدليفري | من `final_delivery_cost` أو من المسافة | ❌ لا (بعد القبول) |
| `delivery_details.distance` | عند القبول وعند تحديث الموقع | من المطعم للعميل (قبول) / من الدليفري للعميل (تحديث) | ✅ نعم |
| `delivery_details.estimated_time` | عند القبول وعند تحديث الموقع | بناءً على المسافة الحالية | ✅ نعم |
| `status` | طوال دورة حياة الطلب | حسب الإجراءات | ✅ نعم |

---

## 🎯 الخلاصة

### المبادئ الأساسية:

1. **تكلفة التوصيل تُحسب من المطعم للعميل** (وليس من الدليفري)
2. **التكلفة ثابتة** بعد إنشاء الطلب
3. **المسافة والوقت المقدر ديناميكيان** للعرض فقط
4. **الطلبات تظهر للدليفري فقط عند "Ready for Delivery"**
5. **الدليفري محدود بـ 3 طلبات نشطة**

### معادلات الحساب:

#### المسافة (Haversine Formula):
```javascript
distance = R * c
حيث:
R = 6371 كم (نصف قطر الأرض)
c = 2 * atan2(√a, √(1-a))
a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
```

#### الوقت المقدر:
```javascript
estimated_time = Math.ceil((distance / 30) * 60) دقيقة
// افتراض سرعة متوسطة 30 كم/ساعة
```

#### تكلفة التوصيل:
```javascript
// Single Order
if (distance <= 3) return 15
else return 15 + Math.ceil(distance - 3) * 4

// Multi Order
if (distance <= 3) return 25
else return 25 + Math.ceil(distance - 3) * 5
```

---

تاريخ التوثيق: 2025-12-03
**المطور:** Antigravity AI Assistant  With ibrahim shorib
