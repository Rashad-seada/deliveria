# 🚀 دليل التشغيل السريع - Deliveria

## ⚡ البدء في 5 خطوات

### الخطوة 1️⃣: التحضير
```bash
cd "d:\Clients projects\dleveria\deliveria"
```

### الخطوة 2️⃣: التثبيت (إن لم يتم بعد)
```bash
npm install
```

### الخطوة 3️⃣: إعداد البيئة
أنشئ ملف `.env` في المجلد الرئيسي:
```env
# قاعدة البيانات
MONGODB_URL=mongodb+srv://user:password@cluster0.0er7krt.mongodb.net/deliveria

# الترخيز
JWT_SECRET=your_super_secret_key_here

# Firebase (للإشعارات)
FIREBASE_CONFIG_PATH=./firebase-config.json
FCM_SERVER_KEY=your_fcm_key

# التشغيل
PORT=8550
NODE_ENV=production

# الخيارات الإضافية
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### الخطوة 4️⃣: التشغيل
```bash
npm start
```

### الخطوة 5️⃣: التحقق
اختبر الاتصال:
```bash
curl http://localhost:8550/api/orders
```

---

## 📌 النقاط المهمة

### ✅ قبل التشغيل
- [ ] تحقق من Node.js v18+
- [ ] تحقق من npm وجود
- [ ] أنشئ ملف .env
- [ ] تأكد من اتصالك بالإنترنت

### ✅ بعد التشغيل
- [ ] تحقق من عدم وجود أخطاء
- [ ] تحقق من اتصال MongoDB
- [ ] تحقق من تسجيل الراوتر

### ⚠️ إذا حدث خطأ

**الخطأ: ECONNREFUSED**
```
المشكلة: MongoDB غير متصل
الحل: تحقق من MONGODB_URL في .env
```

**الخطأ: TypeError: handler must be a function**
```
المشكلة: مشكلة في الواردات
الحل: تم إصلاحها - تأكد من التحديثات الأخيرة
```

**الخطأ: JWT_SECRET not defined**
```
المشكلة: متغير البيئة غير معرّف
الحل: أضفه إلى .env وأعد التشغيل
```

---

## 🧪 اختبار الميزات

### 1. اختبار الطلب العادي
```bash
POST /api/orders
Content-Type: application/json

{
  "user_id": "123",
  "restaurant_id": "456",
  "items": [...],
  "delivery_address": {...}
}
```

### 2. اختبار الطلب من الضيف
```bash
POST /api/orders/guest
Content-Type: application/json

{
  "customer_name": "أحمد محمد",
  "phone": "01012345678",
  "items": [...],
  "delivery_address": {...}
}
```

### 3. اختبار النقاط
```bash
GET /api/users/123/points
GET /api/users/123/points-summary
POST /api/points/redeem-coupon
```

### 4. اختبار الإشعارات
```bash
GET /api/users/123/notifications
POST /api/notifications/mark-as-read
```

### 5. اختبار الفروع
```bash
GET /api/restaurants/456/branches
GET /api/branches/branch-id
```

---

## 📊 مثال كامل: طلب من البداية للنهاية

```bash
# 1. تسجيل المستخدم
POST /api/auth/register
{
  "name": "أحمد",
  "phone": "01012345678",
  "password": "secure123",
  "email": "ahmed@example.com"
}
Response: { user_id: "123", token: "jwt_token" }

# 2. الحصول على المطاعم
GET /api/restaurants?zone_id=zone123
Headers: { Authorization: "Bearer jwt_token" }

# 3. إنشاء طلب
POST /api/orders
Headers: { Authorization: "Bearer jwt_token" }
{
  "restaurant_id": "456",
  "items": [
    { "item_id": "item1", "quantity": 2 },
    { "item_id": "item2", "quantity": 1 }
  ],
  "delivery_address_id": "addr123",
  "coupon_code": "SAVE10" (optional)
}
Response: { order_id: "ord123", total_price: 45.50, status: "Waiting for Approval" }

# 4. تتبع الطلب
GET /api/orders/ord123/track
Response: {
  status: "Waiting for Approval",
  timeline: [...],
  estimated_delivery: "2026-01-08T14:30:00Z"
}

# 5. تقييم الطلب (بعد التسليم)
POST /api/orders/ord123/rate
{
  "rating": 5,
  "comment": "طلب ممتاز وسريع"
}
Response: { points_earned: 12.50 }
```

---

## 🎯 الميزات الرئيسية المتاحة الآن

| الميزة | الحالة | مثال |
|--------|--------|------|
| طلب عادي | ✅ | `POST /api/orders` |
| طلب من ضيف | ✅ | `POST /api/orders/guest` |
| طلب متعدد | ✅ | من عدة مطاعم |
| النقاط | ✅ | 10 + 0.5 لكل جنيه |
| الكوبونات | ✅ | خصم فاتورة أو توصيل |
| الإشعارات | ✅ | 12 نوع مختلف |
| تتبع الطلب | ✅ | حقيقي الوقت |
| إغلاق المطعم | ✅ | عرض قائمة فقط |
| الفروع | ✅ | متعدد الفروع |
| المناطق | ✅ | دائرية وضلعية |
| الإحصائيات | ✅ | تقارير اليوم والأسبوع |

---

## 🔧 أوامر مفيدة

```bash
# بدء التطوير (مع إعادة تحميل)
npm run dev

# بدء الإنتاج
npm start

# الاختبارات
npm test

# مراقبة السجلات
npm run logs

# تنظيف الملفات المؤقتة
npm run clean

# فحص الأخطاء
npm run lint
```

---

## 📱 نقاط نهائية مهمة

### API Base URL
```
http://localhost:8550/api
```

### Headers المطلوبة
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

### Status Codes
- `200` - النجاح
- `201` - تم الإنشاء
- `400` - خطأ في الطلب
- `401` - لم تتم المصادقة
- `403` - لا توجد صلاحية
- `404` - لم يتم العثور
- `500` - خطأ الخادم

---

## ✨ نصائح احترافية

1. **استخدم Postman** لاختبار الـ API بسهولة
2. **راقب السجلات** في Terminal لفهم ما يحدث
3. **استخدم .env** ولا تضع الأسرار في الكود
4. **اختبر بشكل منتظم** قبل النشر
5. **حافظ على النسخ الاحتياطية** قبل التحديث

---

## 🎉 تم!

أنت الآن جاهز للعمل مع Deliveria! 🚀

للمزيد من المعلومات، اطلع على:
- `COMPLETION_SUMMARY.md` - ملخص شامل
- `FINAL_CHECKLIST.md` - قائمة المراجعة
- `IMPLEMENTATION_COMPLETE.md` - دليل مفصل

**استمتع بالعمل!** 💪
