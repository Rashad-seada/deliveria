# Arabic Text Locations - Quick Fix Guide

## Summary
- **Total Files with Arabic**: 4 files
- **Total Arabic Lines**: 20+ instances
- **All in Comments Only**: ✅ Yes (Safe to replace)

---

## File 1: src/utils/deliveryHelpers.js
**Lines to Fix**: 37, 39-40, 44-45

### Current Code:
```javascript
const calculateDeliveryFee = (distance, orderType) => {
    const baseDistance = 3; // 3 كم  ← LINE 37
    if (orderType === "Single") {
        const baseFee = 15; // 15 جنيه  ← LINE 39
        const extraKmCharge = 4; // 4 جنيه لكل كم إضافي  ← LINE 40
        if (distance <= baseDistance) return baseFee;
        return baseFee + Math.ceil(distance - baseDistance) * extraKmCharge;
    } else { // Multi
        const baseFee = 25; // 25 جنيه  ← LINE 44
        const extraKmCharge = 5; // 5 جنيه لكل كم إضافي  ← LINE 45
        if (distance <= baseDistance) return baseFee;
        return baseFee + Math.ceil(distance - baseDistance) * extraKmCharge;
    }
};
```

### Fixed Code:
```javascript
const calculateDeliveryFee = (distance, orderType) => {
    const baseDistance = 3; // 3 km
    if (orderType === "Single") {
        const baseFee = 15; // 15 EGP
        const extraKmCharge = 4; // 4 EGP per additional km
        if (distance <= baseDistance) return baseFee;
        return baseFee + Math.ceil(distance - baseDistance) * extraKmCharge;
    } else { // Multi
        const baseFee = 25; // 25 EGP
        const extraKmCharge = 5; // 5 EGP per additional km
        if (distance <= baseDistance) return baseFee;
        return baseFee + Math.ceil(distance - baseDistance) * extraKmCharge;
    }
};
```

---

## File 2: src/controllers/RestaurantsController.js
**Lines to Fix**: 41, 763, 780-781

### Location 1 - Line 41:
**Current**:
```javascript
// حساب المسافة
const calculateDistance = (lat1, lon1, lat2, lon2) => {
```

**Fixed**:
```javascript
// Calculate distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
```

### Location 2 - Line 763:
**Current**:
```javascript
// لوحة التحكم
module.exports.getDashboard = async (req, res) => {
```

**Fixed**:
```javascript
// Dashboard
module.exports.getDashboard = async (req, res) => {
```

### Location 3 - Lines 780-781:
**Current**:
```javascript
total_orders: 0, // تحتاج إلى حساب الطلبات
total_revenue: 0, // تحتاج إلى حساب الإيرادات
```

**Fixed**:
```javascript
total_orders: 0, // TODO: Calculate actual order count
total_revenue: 0, // TODO: Calculate actual revenue
```

---

## File 3: src/controllers/DeliveryController.js
**Lines to Fix**: 146, 154, 161, 310, 314

### Location 1 - Line 146:
**Current**:
```javascript
// حساب المسافة من المطاعم إلى العميل (وليس من الدليفري إلى العميل)
```

**Fixed**:
```javascript
// Calculate distance from restaurants to customer (not from delivery agent to customer)
```

### Location 2 - Line 154:
**Current**:
```javascript
// حساب أقصى مسافة من المطاعم إلى عنوان العميل
```

**Fixed**:
```javascript
// Calculate max distance from restaurants to customer address
```

### Location 3 - Line 161:
**Current**:
```javascript
// إذا لم يكن موجوداً، احسبه بناءً على المسافة من المطاعم
```

**Fixed**:
```javascript
// If not found, calculate based on distance from restaurants
```

### Location 4 - Line 310:
**Current**:
```javascript
// --- التحسين: التحقق من الموقع الحقيقي قبل إعادة الحساب ---
```

**Fixed**:
```javascript
// --- Optimization: Check actual location before recalculating ---
```

### Location 5 - Line 314:
**Current**:
```javascript
// حساب المسافة من موقع الدليفري الحالي إلى عنوان العميل
```

**Fixed**:
```javascript
// Calculate distance from delivery agent's current location to customer address
```

---

## File 4: src/routes/api/RestaurantsRouter.js
**Line to Fix**: 72

### Current:
```javascript
// لوحة التحكم
router.get('/dashboard', verifyToken, restaurantController.getDashboard);
```

### Fixed:
```javascript
// Dashboard
router.get('/dashboard', verifyToken, restaurantController.getDashboard);
```

---

## Translation Key

| Arabic | English |
|--------|---------|
| كم | km (kilometers) |
| جنيه | EGP (Egyptian Pound) |
| لكل | per |
| إضافي | additional |
| حساب | calculate |
| المسافة | distance |
| من | from |
| المطاعم | restaurants |
| إلى | to |
| العميل | customer |
| الدليفري | delivery |
| لوحة التحكم | dashboard |
| تحتاج | need/requires |
| الطلبات | orders |
| الإيرادات | revenue |
| موجود | exists/found |
| بناءً على | based on |
| التحسين | optimization |
| التحقق | check/verify |
| الموقع | location |
| الحقيقي | actual/real |
| قبل | before |
| إعادة | re- |
| الحساب | calculation |
| الحالي | current |

---

## Automated Fix Script (Node.js)

Save as `fix-arabic.js`:

```javascript
const fs = require('fs');
const path = require('path');

const replacements = [
    // deliveryHelpers.js
    {
        file: 'src/utils/deliveryHelpers.js',
        replacements: [
            { from: '// 3 كم', to: '// 3 km' },
            { from: '// 15 جنيه', to: '// 15 EGP' },
            { from: '// 4 جنيه لكل كم إضافي', to: '// 4 EGP per additional km' },
            { from: '// 25 جنيه', to: '// 25 EGP' },
            { from: '// 5 جنيه لكل كم إضافي', to: '// 5 EGP per additional km' }
        ]
    },
    // RestaurantsController.js
    {
        file: 'src/controllers/RestaurantsController.js',
        replacements: [
            { from: '// حساب المسافة', to: '// Calculate distance' },
            { from: '// لوحة التحكم', to: '// Dashboard' },
            { from: '// تحتاج إلى حساب الطلبات', to: '// TODO: Calculate actual order count' },
            { from: '// تحتاج إلى حساب الإيرادات', to: '// TODO: Calculate actual revenue' }
        ]
    },
    // DeliveryController.js
    {
        file: 'src/controllers/DeliveryController.js',
        replacements: [
            { from: '// حساب المسافة من المطاعم إلى العميل (وليس من الدليفري إلى العميل)', 
              to: '// Calculate distance from restaurants to customer (not from delivery agent to customer)' },
            { from: '// حساب أقصى مسافة من المطاعم إلى عنوان العميل', 
              to: '// Calculate max distance from restaurants to customer address' },
            { from: '// إذا لم يكن موجوداً، احسبه بناءً على المسافة من المطاعم', 
              to: '// If not found, calculate based on distance from restaurants' },
            { from: '// --- التحسين: التحقق من الموقع الحقيقي قبل إعادة الحساب ---', 
              to: '// --- Optimization: Check actual location before recalculating ---' },
            { from: '// حساب المسافة من موقع الدليفري الحالي إلى عنوان العميل', 
              to: '// Calculate distance from delivery agent\'s current location to customer address' }
        ]
    },
    // RestaurantsRouter.js
    {
        file: 'src/routes/api/RestaurantsRouter.js',
        replacements: [
            { from: '// لوحة التحكم', to: '// Dashboard' }
        ]
    }
];

replacements.forEach(({ file, replacements: repl }) => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        let changed = false;
        
        repl.forEach(({ from, to }) => {
            if (content.includes(from)) {
                content = content.replace(from, to);
                changed = true;
                console.log(`✓ Fixed in ${file}: "${from}"`);
            } else {
                console.log(`⚠ Not found in ${file}: "${from}"`);
            }
        });
        
        if (changed) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✓ Updated ${file}\n`);
        }
    } else {
        console.log(`✗ File not found: ${file}\n`);
    }
});

console.log('✓ Arabic text replacement complete!');
```

**To Run**:
```bash
node fix-arabic.js
```

---

## Manual Batch Replacements Using VS Code

1. Open VS Code Find and Replace (Ctrl+H)
2. Enable "Use Regular Expression" (Alt+R)
3. Replace one pattern at a time:

```
Find:  ^(.*)// 3 كم(.*)$
Replace: $1// 3 km$2

Find:  ^(.*)// 15 جنيه(.*)$
Replace: $1// 15 EGP$2

Find:  ^(.*)// حساب المسافة(.*)$
Replace: $1// Calculate distance$2

Find:  ^(.*)// لوحة التحكم(.*)$
Replace: $1// Dashboard$2

Find:  ^(.*)// تحتاج إلى حساب الطلبات(.*)$
Replace: $1// TODO: Calculate actual order count$2
```

---

## Verification Checklist

After applying fixes:

- [ ] All 4 files updated
- [ ] No Arabic characters remain in code comments
- [ ] No Arabic characters in string literals (Data is OK to have Arabic)
- [ ] Code still runs without errors
- [ ] Git diff shows only comment changes
- [ ] Commit message: "fix: Replace Arabic comments with English for internationalization"

---

## Files Summary

| File | Line Count | Arabic Lines | Status |
|------|-----------|--------------|--------|
| src/utils/deliveryHelpers.js | ~80 | 5 | 🔴 Needs Fix |
| src/controllers/RestaurantsController.js | ~1095 | 4 | 🔴 Needs Fix |
| src/controllers/DeliveryController.js | ~400+ | 5 | 🔴 Needs Fix |
| src/routes/api/RestaurantsRouter.js | ~80 | 1 | 🔴 Needs Fix |
| **TOTAL** | | **15** | 🔴 **Action Required** |

---

**Last Updated**: January 8, 2026  
**Priority**: MEDIUM (Code Quality + Internationalization)  
**Effort to Fix**: ~1-2 hours
