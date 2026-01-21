
const router = require("express").Router();

// Import all routers
const addressRouter = require("./api/AddressRouter");
const adminsRouter = require("./api/AdminsRouter");
const agentsRouter = require("./api/AgentsRouter");
const authRouter = require("./api/AuthRouter");
const branchRouter = require("./api/BranchRouter");
const cartsRouter = require("./api/CartsRouter");
const checkoutRouter = require("./api/CheckoutRouter");
const couponCodesRouter = require("./api/CouponCodesRouter");
const deliveryRouter = require("./api/DeliveryRouter");
const dynamicFieldsRouter = require("./api/DynamicFieldsRouter");
const favouritesRouter = require("./api/FavouritesRouter");
const imageRouter = require("./api/ImageRouter");
const inventoryRouter = require("./api/InventoryRouter");
const itemCategoriesRouter = require("./api/ItemCategoriesRouter");
const itemsRouter = require("./api/ItemsRouter");
const loyaltyRouter = require("./api/LoyaltyRouter");
const notificationsRouter = require("./api/NotificationsRouter");
const offersRouter = require("./api/OffersRouter");
const ordersRouter = require("./api/OrdersRouter");
const orderTrackingRouter = require("./api/OrderTrackingRouter");
const restaurantsRouter = require("./api/RestaurantsRouter");
const restaurantStatusRouter = require("./api/RestaurantStatusRouter");
const slidersRouter = require("./api/SlidersRouter");
const statisticsRouter = require("./api/StatisticsRouter");
const superCategoriesRouter = require("./api/SuperCategoriesRouter");
const subCategoriesRouter = require("./api/SubCategoriesRouter");
const systemRouter = require("./api/SystemRouter");
const usersRouter = require("./api/UsersRouter");
const zonesRouter = require("./api/ZonesRouter");

// Use all routers, sorted alphabetically
router.use('/address', addressRouter);
router.use('/admins', adminsRouter);
router.use('/agents', agentsRouter);
router.use('/auth', authRouter);
router.use('/branches', branchRouter);
router.use('/carts', cartsRouter);
router.use('/checkout', checkoutRouter);
router.use('/coupon_codes', couponCodesRouter);
router.use('/delivery', deliveryRouter);
router.use('/dynamic-fields', dynamicFieldsRouter);
router.use('/favourites', favouritesRouter);
router.use('/images', imageRouter);
router.use('/inventory', inventoryRouter);
router.use('/item_categories', itemCategoriesRouter);
router.use('/items', itemsRouter);
router.use('/loyalty', loyaltyRouter);
router.use('/notifications', notificationsRouter);
router.use('/offers', offersRouter);
router.use('/orders', ordersRouter);
router.use('/order-tracking', orderTrackingRouter);
router.use('/restaurants', restaurantsRouter);
router.use('/restaurant-status', restaurantStatusRouter);
router.use('/sliders', slidersRouter);
router.use('/statistics', statisticsRouter);
router.use('/super_categories', superCategoriesRouter);
router.use('/sub_categories', subCategoriesRouter);
router.use('/system', systemRouter);
router.use('/users', usersRouter);
router.use('/zones', zonesRouter);

module.exports = router;
