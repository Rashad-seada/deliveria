# Delveria Backend Development - Implementation Guide

## Project Overview

This document provides a complete guide to the newly implemented backend features for the Delveria Restaurant & Delivery Management System.

---

## Table of Contents

1. [Order Management System](#order-management-system)
2. [Inventory Management](#inventory-management)
3. [Offers System](#offers-system)
4. [Checkout System](#checkout-system)
5. [Image Management](#image-management)
6. [Dynamic Forms](#dynamic-forms)
7. [Multi-Branch System](#multi-branch-system)
8. [Guest User System](#guest-user-system)
9. [Statistics & Reporting](#statistics--reporting)
10. [Restaurant Status Management](#restaurant-status-management)
11. [API Endpoints Reference](#api-endpoints-reference)

---

## Order Management System

### Order State Machine

The order lifecycle follows a robust state machine with predefined state transitions:

**States:**
- `Waiting for Approval` - Order submitted, awaiting restaurant confirmation
- `Approved / Preparing` - Restaurant accepted, preparing order
- `Packed / Ready for Pickup` - Order ready for pickup by delivery agent
- `On the Way` - Delivery agent picked up and en route
- `Delivered` - Order successfully delivered
- `Canceled` - Order canceled at applicable stages

**Implementation Files:**
- `src/utils/orderStateMachine.js` - Core state machine logic
- `src/controllers/OrderTrackingController.js` - State transition handling
- `src/models/Orders.js` - Updated with state timeline tracking

**Key Features:**
- Validates all state transitions
- Maintains status timeline with timestamps and notes
- Tracks who updated each status
- Prevents invalid transitions with clear error messages
- Supports multi-order (restaurant) processing

**State Transition Diagram:**
```
Waiting for Approval → Approved / Preparing → Packed / Ready → On the Way → Delivered
         ↓                    ↓                     ↓
      Canceled            Canceled               Canceled
```

### Order Tracking API

**Endpoints:**
- `GET /order-tracking/:orderId` - Get order details
- `GET /order-tracking/:orderId/tracking` - Get order status timeline
- `PUT /order-tracking/:orderId/status` - Update order status
- `POST /order-tracking/:orderId/cancel` - Cancel order
- `GET /order-tracking/customer/orders` - Get user's orders
- `GET /order-tracking/restaurant/orders` - Get restaurant's orders
- `GET /order-tracking/agent/orders` - Get agent's delivery orders

---

## Inventory Management

### Product Quantity Management

**Features:**
- Real-time stock level tracking
- Automatic decrement on order confirmation
- Low-stock alerts system
- Size-specific inventory tracking
- Bulk quantity updates

**Implementation Files:**
- `src/models/Items.js` - Enhanced with quantity fields
- `src/utils/inventoryManager.js` - Core inventory logic
- `src/controllers/InventoryController.js` - API handlers

**Key Functions:**

```javascript
// Decrement quantity (used when order is confirmed)
decrementProductQuantity(itemId, quantity, sizeId)

// Increment quantity (restocking)
incrementProductQuantity(itemId, quantity, sizeId)

// Set exact quantity
setProductQuantity(itemId, quantity, sizeId)

// Get current quantity
getProductQuantity(itemId, sizeId)

// Set low-stock threshold
setLowStockThreshold(itemId, threshold)

// Get all low-stock items
getLowStockItems(restaurantId, branchId)

// Get inventory summary
getInventorySummary(restaurantId, branchId)
```

**Endpoints:**
- `GET /inventory/product/:itemId/quantity` - Get quantity
- `PUT /inventory/product/:itemId/quantity` - Update quantity
- `POST /inventory/product/:itemId/increment` - Increment quantity
- `GET /inventory/product/:itemId/threshold` - Get threshold
- `PUT /inventory/product/:itemId/threshold` - Set threshold
- `GET /inventory/low-stock` - Get low-stock items
- `GET /inventory/summary` - Get summary
- `POST /inventory/bulk-update` - Bulk update quantities

---

## Offers System

### Promotional Offers Management

**Features:**
- Multiple offer types: Percentage, Fixed Amount, Buy X Get Y, Free Item
- Time-based activation (date range, time range, specific days)
- Per-restaurant or global offers
- Item/category specific offers
- Usage limits (total and per-user)
- Offer stacking control

**Implementation Files:**
- `src/models/Offer.js` - Offer schema
- `src/utils/offerManager.js` - Offer logic
- `src/controllers/OffersController.js` - API handlers

**Offer Types:**

1. **Percentage** - Discount percentage (e.g., 20% off)
   - Supports maximum discount cap
   - Example: 20% off, max 50 AED

2. **FixedAmount** - Fixed discount (e.g., 10 AED off)
   - Simple fixed deduction
   - Example: 10 AED off all orders

3. **BuyXGetY** - Purchase multiple get discounted
   - Buy 2 get 1 free
   - Buy 3 get 50% off

4. **FreeItem** - Get free item with purchase
   - Purchase any item, get free item
   - Restaurant-specific only

**Endpoints:**
- `POST /offers` - Create offer (Admin)
- `GET /offers` - Get all offers
- `GET /offers/:offerId` - Get specific offer
- `PUT /offers/:offerId` - Update offer
- `DELETE /offers/:offerId` - Delete offer
- `GET /offers/available/applicable` - Get applicable offers for cart
- `POST /offers/:offerId/apply` - Apply to price
- `GET /offers/active/list` - Get active offers
- `PATCH /offers/:offerId/status` - Toggle status

---

## Checkout System

### Final Checkout Process

**Features:**
- Cart validation
- Order total calculation with breakdown
- Tax calculation
- Delivery fee calculation
- Coupon application
- Offer application
- Payment integration ready
- Order creation with complete data

**Implementation Files:**
- `src/utils/checkoutManager.js` - Checkout logic
- `src/controllers/CheckoutController.js` - API handlers

**Checkout Flow:**
```
1. Validate Cart
   ├─ Check item availability
   ├─ Verify restaurants are open
   └─ Confirm address

2. Calculate Total
   ├─ Subtotal
   ├─ Apply coupon discount
   ├─ Apply offers
   ├─ Calculate tax
   └─ Add delivery fee

3. Create Order
   ├─ Generate order ID
   ├─ Decrement inventory
   ├─ Clear cart
   └─ Save order record

4. Process Payment
   ├─ Validate amount
   ├─ Integration with payment gateway
   └─ Confirm payment
```

**Endpoints:**
- `POST /checkout/validate` - Validate cart
- `POST /checkout/calculate-total` - Calculate breakdown
- `GET /checkout/summary` - Get checkout summary
- `POST /checkout/validate-coupon` - Validate coupon
- `POST /checkout/complete` - Complete checkout
- `POST /checkout/:orderId/payment` - Process payment

**Response Example:**
```json
{
  "breakdown": {
    "subtotal": 150.00,
    "coupon_discount": 15.00,
    "offers_discount": 10.00,
    "total_discount": 25.00,
    "tax": 12.50,
    "delivery_fee": 20.00,
    "final_total": 157.50
  }
}
```

---

## Image Management

### Image Upload and Processing

**Features:**
- Single and bulk upload
- Automatic image optimization
- Thumbnail generation
- Multiple format support (JPEG, PNG, WebP)
- Size validation (5MB limit)
- Old image cleanup on replacement
- WebP conversion for better performance

**Implementation Files:**
- `src/utils/imageManager.js` - Image processing
- `src/controllers/ImageController.js` - API handlers

**Image Versions Created:**
1. **Original** - Full resolution
2. **Thumbnail** - 200x200px (for listings)
3. **Optimized** - 800x600px (for details)

**Endpoints:**
- `POST /images/upload` - Upload single image
- `POST /images/bulk-upload` - Upload multiple
- `POST /images/item/:itemId` - Update item image
- `POST /images/restaurant/:restaurantId` - Update restaurant image
- `DELETE /images/delete` - Delete image
- `POST /images/batch-delete` - Batch delete

---

## Dynamic Forms

### Custom Fields System

**Features:**
- EAV (Entity-Attribute-Value) pattern
- Multiple field types support
- Field validation rules
- Required/optional fields
- Default values
- Display ordering
- Bulk creation

**Implementation Files:**
- `src/models/DynamicField.js` - Field schema
- `src/controllers/DynamicFieldsController.js` - API handlers

**Supported Field Types:**
- `text` - Short text input
- `email` - Email input with validation
- `phone` - Phone number with validation
- `number` - Numeric input with min/max
- `date` - Date picker
- `checkbox` - Boolean checkbox
- `select` - Dropdown with options
- `textarea` - Long text area
- `file` - File upload
- `url` - URL with validation

**Validation Rules:**
```javascript
validation_rules: {
  min_length: 3,
  max_length: 50,
  pattern: "^[a-zA-Z]+$",
  min_value: 0,
  max_value: 100,
  allowed_values: ["option1", "option2"]
}
```

**Endpoints:**
- `POST /dynamic-fields` - Create field
- `POST /dynamic-fields/bulk-create` - Bulk create
- `GET /dynamic-fields/entity` - Get entity fields
- `GET /dynamic-fields/type` - Get by type
- `GET /dynamic-fields/:fieldId` - Get specific field
- `PUT /dynamic-fields/:fieldId` - Update field
- `PATCH /dynamic-fields/:fieldId/value` - Update value
- `DELETE /dynamic-fields/:fieldId` - Delete field

---

## Multi-Branch System

### Restaurant Branch Management

**Features:**
- Multiple branches per restaurant
- Branch-specific inventory
- Branch-specific pricing
- Branch staff assignment
- Independent branch orders
- Role-based access control
- Branch performance tracking

**Implementation Files:**
- `src/models/Branch.js` - Branch schema
- `src/controllers/BranchController.js` - API handlers

**Branch Properties:**
- Location and coordinates
- Operating hours
- Manager assignment
- Staff management
- Independent inventory
- Delivery fee
- Open/close status

**Endpoints:**
- `POST /branches/:restaurant_id` - Create branch
- `GET /branches/:restaurant_id` - Get branches
- `GET /branches/available/:restaurant_id` - Get available branches
- `GET /branches/branch/:branchId` - Get branch details
- `PUT /branches/branch/:branchId` - Update branch
- `PATCH /branches/branch/:branchId/toggle` - Toggle status
- `POST /branches/branch/:branchId/staff` - Assign staff
- `DELETE /branches/branch/:branchId/staff/:staffId` - Remove staff
- `GET /branches/branch/:branchId/inventory` - Get inventory
- `GET /branches/branch/:branchId/orders` - Get orders
- `GET /branches/branch/:branchId/statistics` - Get statistics

---

## Guest User System

### Guest Ordering

**Features:**
- Order without registration
- Collect temporary contact info
- Link orders to email/phone
- Order tracking via phone/email
- Optional registration after order

**Implementation in Checkout:**
```javascript
// Guest user data
{
  guest_user: {
    name: "John Doe",
    phone: "+971501234567",
    email: "john@example.com"
  }
}
```

**Order Creation with Guests:**
- Orders tracked by phone/email
- No user account required
- Can provide optional email for tracking
- Simplified checkout flow

---

## Statistics & Reporting

### Dashboard and Reports

**Features:**
- Real-time dashboard statistics
- Revenue reports (daily/weekly/monthly)
- Top selling products
- Order status distribution
- Customer analysis
- Delivery performance metrics
- CSV export capability

**Implementation Files:**
- `src/controllers/StatisticsController.js` - Analytics
- `src/routes/api/StatisticsRouter.js` - Endpoints

**Reports Available:**

1. **Dashboard Statistics**
   - Total orders and revenue
   - Order status breakdown
   - New customers count
   - Success rate

2. **Revenue Report**
   - Period-based grouping
   - Daily/weekly/monthly breakdown
   - Total and average revenue

3. **Top Selling Products**
   - Product quantity sold
   - Revenue per product
   - Customizable limit

4. **Order Distribution**
   - Status breakdown
   - Percentage distribution
   - Trend analysis

5. **Customer Analysis**
   - Unique customer count
   - Total spent per customer
   - Repeat customers
   - Average order value

6. **Delivery Performance**
   - Average delivery time
   - Median delivery time
   - On-time delivery count

**Endpoints:**
- `GET /statistics/dashboard` - Dashboard stats
- `GET /statistics/revenue` - Revenue report
- `GET /statistics/products/top-selling` - Top products
- `GET /statistics/orders/distribution` - Status distribution
- `GET /statistics/customers/analysis` - Customer analysis
- `GET /statistics/delivery/performance` - Delivery metrics
- `GET /statistics/export` - Export as CSV

**Report Parameters:**
```
startDate: "2024-01-01"
endDate: "2024-01-31"
restaurantId: "restaurant_id_here"
groupBy: "daily" | "weekly" | "monthly"
limit: 10
```

---

## Restaurant Status Management

### Opening/Closing System

**Features:**
- Manual open/close control
- Scheduled auto open/close
- Operating hours configuration
- Current status checking
- Last-minute order handling
- Automatic pending order cancellation on close
- Operating schedule display

**Implementation Files:**
- `src/controllers/RestaurantStatusController.js` - Status management
- `src/routes/api/RestaurantStatusRouter.js` - Endpoints

**Status Management Features:**

1. **Manual Control**
   - Close restaurant immediately
   - Reopen restaurant
   - Specify closure reason

2. **Schedule Management**
   - Set daily operating hours
   - Automatic opening at scheduled time
   - Automatic closing at scheduled time
   - Cancel pending orders on auto-close

3. **Last-Minute Orders**
   - Configure cutoff time before closing
   - Prevent orders within cutoff window
   - Graceful handling of edge cases

4. **Status Checking**
   - Real-time availability check
   - Next opening/closing times
   - Current operating status

**Endpoints:**
- `GET /restaurant-status/:restaurantId/status` - Get status
- `POST /restaurant-status/:restaurantId/close` - Close restaurant
- `POST /restaurant-status/:restaurantId/open` - Open restaurant
- `PUT /restaurant-status/:restaurantId/hours` - Set hours
- `GET /restaurant-status/:restaurantId/schedule` - Get schedule
- `POST /restaurant-status/:restaurantId/schedule-auto` - Auto schedule
- `GET /restaurant-status/:restaurantId/validate-order` - Validate placement
- `POST /restaurant-status/:restaurantId/last-minute-orders` - Last-minute config

**Time Format:** `HH:MM` (24-hour format)

---

## Database Models

### Updated/New Models

1. **Orders** - Enhanced with state machine, guest support, offers/coupons tracking
2. **Items** - Added quantity, low-stock threshold, size-specific quantities
3. **Offer** - New model for promotional offers
4. **Branch** - New model for multi-branch support
5. **DynamicField** - New model for custom fields
6. **Restaurant** - Enhanced with opening/closing fields

---

## API Endpoints Reference

### Order Tracking
```
GET    /order-tracking/:orderId
GET    /order-tracking/:orderId/tracking
PUT    /order-tracking/:orderId/status
PUT    /order-tracking/:orderId/restaurant/:restaurantId/status
POST   /order-tracking/:orderId/cancel
GET    /order-tracking/customer/orders
GET    /order-tracking/restaurant/orders
GET    /order-tracking/agent/orders
POST   /order-tracking/:orderId/assign-agent
```

### Inventory
```
GET    /inventory/product/:itemId/quantity
PUT    /inventory/product/:itemId/quantity
POST   /inventory/product/:itemId/increment
GET    /inventory/product/:itemId/threshold
PUT    /inventory/product/:itemId/threshold
GET    /inventory/low-stock
GET    /inventory/summary
POST   /inventory/bulk-update
GET    /inventory/report
```

### Offers
```
POST   /offers
GET    /offers
GET    /offers/:offerId
PUT    /offers/:offerId
DELETE /offers/:offerId
GET    /offers/available/applicable
POST   /offers/:offerId/apply
GET    /offers/active/list
POST   /offers/:offerId/usage
PATCH  /offers/:offerId/status
GET    /offers/statistics/summary
```

### Checkout
```
POST   /checkout/validate
POST   /checkout/calculate-total
GET    /checkout/summary
POST   /checkout/validate-coupon
POST   /checkout/complete
POST   /checkout/:orderId/payment
```

### Images
```
POST   /images/upload
POST   /images/bulk-upload
POST   /images/item/:itemId
POST   /images/restaurant/:restaurantId
DELETE /images/delete
POST   /images/batch-delete
GET    /images/info
```

### Dynamic Fields
```
POST   /dynamic-fields
POST   /dynamic-fields/bulk-create
GET    /dynamic-fields/entity
GET    /dynamic-fields/type
GET    /dynamic-fields/:fieldId
PUT    /dynamic-fields/:fieldId
PATCH  /dynamic-fields/:fieldId/value
DELETE /dynamic-fields/:fieldId
```

### Branches
```
POST   /branches/:restaurant_id
GET    /branches/:restaurant_id
GET    /branches/available/:restaurant_id
GET    /branches/branch/:branchId
PUT    /branches/branch/:branchId
PATCH  /branches/branch/:branchId/toggle
DELETE /branches/branch/:branchId
POST   /branches/branch/:branchId/staff
DELETE /branches/branch/:branchId/staff/:staffId
GET    /branches/branch/:branchId/inventory
GET    /branches/branch/:branchId/orders
GET    /branches/branch/:branchId/statistics
```

### Statistics
```
GET    /statistics/dashboard
GET    /statistics/revenue
GET    /statistics/products/top-selling
GET    /statistics/orders/distribution
GET    /statistics/customers/analysis
GET    /statistics/delivery/performance
GET    /statistics/export
```

### Restaurant Status
```
GET    /restaurant-status/:restaurantId/status
POST   /restaurant-status/:restaurantId/close
POST   /restaurant-status/:restaurantId/open
PUT    /restaurant-status/:restaurantId/hours
GET    /restaurant-status/:restaurantId/schedule
POST   /restaurant-status/:restaurantId/schedule-auto
GET    /restaurant-status/:restaurantId/validate-order
POST   /restaurant-status/:restaurantId/last-minute-orders
```

---

## Authentication

All endpoints marked with `verifyToken` require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Error Handling

Standard error response format:
```json
{
  "message": "Error description",
  "error": "Detailed error message"
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `500` - Server Error

---

## Installation & Setup

### Install Dependencies
```bash
npm install
```

### Environment Variables
Add to `.env`:
```
MONGO_URL=mongodb://connection_string
NODE_ENV=development
PORT=8550
CORS_ALLOWED_ORIGINS=http://localhost:3000
```

### Start Server
```bash
npm start
```

---

## Next Steps

1. **Frontend Integration** - Integrate APIs with frontend
2. **Payment Gateway** - Integrate Stripe/PayPal/etc.
3. **Notifications** - Implement real-time notifications
4. **Testing** - Add unit and integration tests
5. **Documentation** - API documentation with Swagger/OpenAPI

---

## Support

For questions or issues, contact the development team.

Last Updated: January 2026
