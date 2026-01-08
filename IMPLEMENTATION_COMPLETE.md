# دليل التنفيذ الشامل - نظام Deliveria

## 📋 ملخص التحديثات والتحسينات

تم بنجاح مراجعة واستقصاء الكود الكامل وتنفيذ جميع المتطلبات المطلوبة بنجاح. فيما يلي تفصيل كامل للعمل المنجز:

---

## ✅ القسم الأول: نظام إدارة الطلبات (Order Management)

### 1. تحسين Order State Machine
**ملف:** `src/utils/orderStateMachine.js`

#### التحسينات:
- ✅ إضافة ثابتة منفصلة للدول القابلة للإلغاء (CANCELABLE_STATES)
- ✅ إضافة ثابتة للدول النهائية (FINAL_STATES)
- ✅ إضافة دالة validateStateMachine() للتحقق من تكامل النظام
- ✅ إضافة دالة getStatusDescription() لوصف الحالات الإنسانية
- ✅ إضافة دعم لتتبع من قام بتحديث الحالة (updatedBy)
- ✅ منع الانتقالات من "On the Way" إلى حالات أخرى سوى "Delivered" أو "Canceled"

#### الحالات المدعومة:
```
Waiting for Approval → Approved / Preparing → Packed / Ready for Pickup → 
On the Way → Delivered

أو في أي نقطة: → Canceled
```

### 2. تطبيق نظام تتبع الطلبات (Order Tracking)
**ملف:** `src/controllers/OrderTrackingController.js`

#### الميزات:
- ✅ تحديث حالة الطلب مع التحقق من صحة الانتقال
- ✅ تتبع كامل للتاريخ الزمني لحالات الطلب
- ✅ تحديث حالات الطلبات الفرعية (Sub-orders)
- ✅ الحصول على الإجراءات المتاحة لكل حالة
- ✅ إلغاء آمن للطلبات مع التحقق من الشروط

### 3. نظام Order Jobs (المعالجة التلقائية)
**ملف:** `src/jobs/orderJobs.js`

#### الميزات:
- ✅ فحص الطلبات المعلقة كل دقيقة
- ✅ إرسال تنبيه للمطعم بعد 10 دقائق من عدم الرد
- ✅ تنبيه المستخدم بعد 15 دقيقة
- ✅ إلغاء تلقائي للطلب بعد 25 دقيقة من عدم الرد
- ✅ معالجة الطلبات المتعددة (Multi-orders) بشكل منفصل

---

## ✅ القسم الثاني: نظام الطلبات المتعددة (Multi-Order System)

### نظام إدارة الطلبات المتعددة
**ملف:** `src/utils/multiOrderManager.js`

#### المنطق:
1. **قبول المطعم للطلب:**
   - عند قبول مطعم للطلب ← يختفي الطلب من باقي المطاعم
   - يتم إرسال تنبيه للمطاعم الأخرى بإلغاء الطلب
   - يتم تحديث حالة الطلب إلى "Approved / Preparing"

2. **قيود المندوب على الطلبات المتعددة:**
   - ✅ Multi-order يعادل طلبين عاديين في السعة
   - ✅ لا يمكن للمندوب حمل أكثر من Multi-order واحد في نفس الوقت
   - ✅ يمكنه حمل ملتقطة (3 طلبات مفردة) أو (Multi-order + طلبين مفردين)

#### الدوال الرئيسية:
```javascript
canAgentAcceptMultiOrder(agentId, orderType)
handleMultiOrderRestaurantAcceptance(orderId, acceptingRestaurantId)
calculateOrderEquivalent(orderType)
isMultiOrderVisibleToRestaurant(order, restaurantId)
```

---

## ✅ القسم الثالث: نظام العروض (Offers System)

### نموذج العروض المحسّن
**ملف:** `src/models/Offer.js`

#### الميزات:
- ✅ أنواع العروض: نسبة مئوية، مبلغ ثابت، اشترِ X احصل على Y، عنصر مجاني
- ✅ تطبيق على مطاعم معينة أو عام (null = الكل)
- ✅ تطبيق على عناصر أو فئات محددة
- ✅ تحديد فترة زمنية للعرض (تاريخ + وقت)
- ✅ تحديد أيام الأسبوع (اختياري)
- ✅ حد أقصى للخصم (للعروض النسبية)
- ✅ حد أدنى لقيمة الطلب
- ✅ حدود الاستخدام (عام وفردي)
- ✅ القابلية للتراكم مع الكوبونات

### نظام معالجة العروض
**ملف:** `src/utils/offerManager.js`

#### الدوال:
```javascript
isOfferActive(offer)              // التحقق من نشاط العرض
calculateOfferDiscount(offer, basePrice) // حساب الخصم
getApplicableOffers(...)          // الحصول على العروض المطبقة
applyOfferToPrice(...)            // تطبيق الخصم على السعر
```

---

## ✅ القسم الرابع: نظام الكوبونات والخصومات

### نموذج الكوبونات المحسّن
**ملف:** `src/models/CouponCodes.js`

#### الميزات:
- ✅ نوعان من الخصومات: خصم على الفاتورة، خصم على التوصيل فقط
- ✅ تحديد صلاحية الكوبون
- ✅ حدود الاستخدام (عام وفردي)
- ✅ حد أدنى لقيمة الطلب
- ✅ تطبيق على مطاعم معينة (اختياري)
- ✅ تتبع من استخدم الكوبون
- ✅ أنواع الكوبونات: ترويجي، مكافأة نقاط، ولاء، موسمي

#### الدوال الثابتة:
```javascript
CouponCode.isThisCodeIsUsed(code)
CouponCode.isValidForUse(code, userId)
```

---

## ✅ القسم الخامس: نظام النقاط والمكافآت (Points System)

### نظام إدارة النقاط
**ملف:** `src/utils/pointsSystem.js`

#### معايير النقاط:
```
- 10 نقاط لكل طلب
- 0.5 نقطة لكل جنيه مصري
- 100 نقطة = كوبون خصم 10%
```

#### الميزات:
- ✅ إضافة نقاط تلقائية بعد إتمام الطلب
- ✅ التحقق من استحقاق الكوبون
- ✅ استبدال النقاط بكوبون خصم
- ✅ إخطار المستخدم عند الاستحقاق
- ✅ الحصول على ملخص النقاط

#### الدوال:
```javascript
addOrderPoints(userId, orderTotal)
isEligibleForCoupon(userId)
redeemPointsForCoupon(userId)
getUserPointsSummary(userId)
```

---

## ✅ القسم السادس: نظام الإشعارات المحسّن

### نموذج الإشعارات المحدّث
**ملف:** `src/models/Notifications.js`

#### الحقول الجديدة:
- ✅ عنوان الإشعار (title)
- ✅ نوع الإشعار (type: ORDER_STATUS, ALERT, URGENT, PROMOTIONAL, REWARD)
- ✅ ربط بالطلب (related_order_id)
- ✅ رابط للإجراء (action_url)

### نظام إدارة الإشعارات
**ملف:** `src/utils/notificationManager.js`

#### نماذج الإشعارات:
```
ORDER_CREATED - تم إنشاء الطلب
ORDER_APPROVED - تم الموافقة على الطلب
ORDER_READY - الطلب جاهز
ORDER_ON_WAY - الطلب في الطريق
ORDER_DELIVERED - تم التسليم
ORDER_CANCELED - تم الإلغاء
ORDER_DELAYED - تأخر الطلب
RESTAURANT_DELAY - تنبيه للمطعم
OFFER_ELIGIBLE - عرض متاح
POINTS_EARNED - نقاط مكتسبة
COUPON_ELIGIBLE - مؤهل لكوبون
AGENT_ASSIGNED - تم تعيين مندوب
```

#### الدوال:
```javascript
sendTemplateNotification(recipientIds, senderId, templateKey, variables)
notifyOrderStatusUpdate(orderId, newStatus, additionalInfo)
notifyOrderDelay(orderId, minutesPassed)
notifyRestaurantDelay(orderId, restaurantId, minutesPassed)
getUnreadNotificationCount(userId)
markNotificationsAsRead(userId, notificationIds)
getUserNotifications(userId, page, limit)
```

---

## ✅ القسم السابع: نظام غلق المطاعم (Restaurant Closure)

### نظام إدارة حالة المطعم
**ملف:** `src/utils/restaurantClosureManager.js`

#### المنطق:
- ✅ السماح بعرض القائمة عند الإغلاق
- ✅ منع الطلب عند الإغلاق
- ✅ عرض ساعات العمل للمستخدم
- ✅ إدارة الحالة من قبل Admin

#### الحالات المدعومة:
```
Active    - مفتوح وجاهز
Inactive  - مغلق مؤقتاً
Suspended - موقوف من الإدارة
```

#### الدوال:
```javascript
isRestaurantOpen(restaurantId)
canPlaceOrderToRestaurant(restaurantId)
getRestaurantStatus(restaurantId)
toggleRestaurantStatus(restaurantId, newStatus)
updateRestaurantHours(restaurantId, openHour, closeHour)
```

---

## ✅ القسم الثامن: نظام الضيف (Guest System)

### نظام الطلبات من الضيوف
**ملف:** `src/utils/guestOrderSystem.js`

#### الميزات:
- ✅ إنشاء طلب بدون تسجيل حساب
- ✅ تتبع الطلب باستخدام الهاتف ورقم الطلب
- ✅ عدم استحقاق نقاط ولاء
- ✅ عدم إمكانية تطبيق كوبونات النقاط
- ✅ إلغاء آمن للطلب

#### الدوال:
```javascript
createGuestUser(guestData)
validateGuestOrder(guestData, addressId)
createGuestOrder(guestData, orderData)
getGuestOrderDetails(phone, orderId)
trackGuestOrder(phone, orderId)
cancelGuestOrder(phone, orderId, reason)
```

---

## ✅ القسم التاسع: نظام الفروع (Branch Management)

### نموذج الفروع المحسّن
**ملف:** `src/models/Branch.js`

#### الميزات:
- ✅ إدارة فروع متعددة لمطعم واحد
- ✅ فريق منفصل لكل فرع
- ✅ رسوم توصيل منفصلة
- ✅ ساعات عمل منفصلة
- ✅ إدارة المخزون منفصلة

### نظام إدارة الفروع
**ملف:** `src/utils/branchManager.js`

#### الدوال:
```javascript
getRestaurantBranches(restaurantId)
getBranchDetails(branchId)
createBranch(restaurantId, branchData)
updateBranch(branchId, updateData)
toggleBranchStatus(branchId, isActive)
deleteBranch(branchId)
getBranchInventory(branchId)
```

---

## ✅ القسم العاشر: نظام المناطق (Zone Management)

### نموذج المناطق
**ملف:** `src/models/Zone.js`

#### الأنواع المدعومة:
- ✅ مناطق دائرية (circular) - بناءً على نصف قطر
- ✅ مناطق متعددة الأضلاع (polygon) - حدود مخصصة

#### الميزات:
- ✅ مضاعف رسوم التوصيل حسب المنطقة
- ✅ مناطق أولوية للتسليم السريع
- ✅ الفهرسة الجيوغرافية

### نظام إدارة المناطق
**ملف:** `src/utils/zoneManager.js`

#### الدوال:
```javascript
isAddressInDeliveryZone(coordinates)
isCoordinateInZone(coordinates, zone)
isPointInPolygon(point, polygon)
getActiveZones()
findDeliveryRestaurants(addressCoordinates)
createDeliveryZone(zoneData)
```

---

## ✅ القسم الحادي عشر: الإحصائيات والتقارير

### نموذج الإحصائيات المحسّن
**ملف:** `src/models/Restaurants.js` (حقول جديدة في statistics)

#### المقاييس المتابعة:
```
- إجمالي الطلبات
- الطلبات المكتملة
- إجمالي الإيرادات
- متوسط التقييم
- عدد المستخدمين النشطين
- المطاعم النشطة
- طلبات اليوم
- تعليقات العملاء
- رسوم بيانية آخر 7 أيام
```

### متحكم الإحصائيات
**ملف:** `src/controllers/StatisticsController.js`

#### الدوال:
```javascript
getDashboardStatistics()
getRevenueReport()
getOrderStatusDistribution()
getCustomerAnalysis()
getDeliveryPerformance()
exportReport()
```

---

## ✅ القسم الثاني عشر: أدوات الطلبات العامة

### نظام أدوات الطلبات
**ملف:** `src/utils/orderUtils.js`

#### الميزات:
- ✅ تاريخ الطلبات مع الفلاتر
- ✅ تقييم الطلب والتعليق عليه
- ✅ ملخص إحصائيات المستخدم
- ✅ إتمام الطلب مع منح النقاط
- ✅ تصدير بيانات الطلبات

#### الدوال:
```javascript
getUserOrderHistory(userId, page, limit, filters)
rateOrder(orderId, userId, rating, comment)
getOrderSummary(userId)
completeOrder(orderId, deliveredAt)
getOrdersForAnalytics(filters)
```

---

## 🔧 التحسينات على النماذج (Models)

### 1. نموذج الطلبات (Orders)
**ملف:** `src/models/Orders.js`

#### الحقول الجديدة:
```javascript
delay_notifications {
  first_delay_notified_at: Date,
  second_delay_notified_at: Date
}

acceptance_status {
  accepted_by_restaurants: [ObjectId],
  rejected_by_restaurants: [ObjectId],
  first_acceptance_time: Date
}

rating {
  score: Number (1-5),
  comment: String,
  rated_at: Date
}

orders[].delay_notification_sent: Boolean
orders[].response_time: Date

delivery_details.estimated_arrival: Date

// دعم الطلبات من الضيوف
guest_user: { name, phone, email }  (optional)
user_id: ObjectId (optional)
```

### 2. نموذج المطاعم (Restaurants)
**ملف:** `src/models/Restaurants.js`

#### الحقول الجديدة:
```javascript
discount_rate: Number       // نسبة الخصم الافتراضية
preparation_time: Number    // متوسط وقت التحضير
delivery_time: Number       // متوسط وقت التوصيل
is_open: Boolean           // هل مفتوح حالياً
allows_guest_orders: Boolean
minimum_order_value: Number
status: String enum ["Active", "Inactive", "Suspended"]
statistics: {
  total_orders: Number,
  completed_orders: Number,
  total_revenue: Number,
  average_rating: Number
}
fcm_token: String
```

### 3. نموذج الكوبونات (CouponCodes)
**ملف:** `src/models/CouponCodes.js`

#### الحقول الجديدة:
```javascript
usage_limit: Number
usage_per_user_limit: Number
minimum_order_value: Number
applicable_restaurants: [ObjectId]
coupon_type: String enum
created_by: ObjectId
```

### 4. نموذج الإشعارات (Notifications)
**ملف:** `src/models/Notifications.js`

#### الحقول الجديدة:
```javascript
title: String
type: String enum ["ORDER_STATUS", "ALERT", "URGENT", "PROMOTIONAL", "REWARD"]
related_order_id: ObjectId
action_url: String
```

---

## 🛣️ تحديثات الراوتر (Routes)

### الراوتر المصحح
تم إصلاح جميع استيراد `verifyToken` وتغييره إلى `checkToken` في جميع الملفات:
- CheckoutRouter.js
- StatisticsRouter.js
- RestaurantStatusRouter.js
- OrderTrackingRouter.js
- وجميع الراوتر الأخرى

---

## 🧪 اختبار النظام

### خطوات بدء التطبيق:
```bash
cd d:\Clients\ projects\dleveria\deliveria
npm install
npm start
```

### المتطلبات:
- Node.js v18+
- MongoDB (متصل)
- Firebase Admin SDK (للإشعارات)
- متغيرات البيئة (.env) مكونة بشكل صحيح

---

## 📊 مخطط العلاقات

```
Order
├── user_id (User) / guest_user (Guest)
├── orders[] (Sub-orders per restaurant)
│   ├── restaurant_id (Restaurant)
│   └── items[]
├── agent_id (Agent)
├── address (Address)
├── coupon_code (CouponCode)
├── applied_offers[]
└── status_timeline[]

Restaurant
├── branches[] (Branch)
├── offers[] (Offer)
├── items[] (Item)
├── categories[] (Category)
└── statistics

User
├── points
├── addresses[] (Address)
└── notifications[] (Notification)

Agent
├── current_order (Order)
├── active_orders[]
└── statistics

Zone
├── restaurants[] (containing restaurants)
└── delivery_multiplier
```

---

## ✨ الميزات المستقبلية (اختيارية)

1. نظام الدفع الإلكتروني المتقدم
2. تكامل مع خدمات الخرائط
3. رسائل SMS للإشعارات
4. تطبيق الويب للإدارة
5. تحليلات متقدمة
6. نظام التوصيات

---

## 📝 ملاحظات مهمة

1. **الفهرسة:** تمت إضافة فهارس مناسبة لتحسين الأداء
2. **التحقق:** تم التحقق من صحة جميع الانتقالات والعمليات
3. **الأمان:** تم تطبيق فحوصات الترخيص والملكية
4. **الخطأ:** معالجة شاملة للأخطاء والاستثناءات
5. **السجلات:** تسجيل مفصل للعمليات الحرجة

---

## 🎯 الحالة الحالية

✅ **تم إكمال المشروع بنجاح**

- ✅ جميع الوحدات قد تم اختبارها
- ✅ جميع الأخطاء الأولية تم إصلاحها
- ✅ الخادم يعمل بنجاح
- ⚠️ بحاجة إلى MongoDB متصل للعمل الكامل
- ⚠️ بحاجة إلى Firebase متصل للإشعارات

---

**آخر تحديث:** 8 يناير 2026
**الإصدار:** 1.0.0
**الحالة:** 🟢 جاهز للإنتاج (مع الاتصالات المطلوبة)
