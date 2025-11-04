
const router = require("express").Router();

// Import all routers
const addressRouter = require("./api/AddressRouter");
const adminsRouter = require("./api/AdminsRouter");
const agentsRouter = require("./api/AgentsRouter");
const authRouter = require("./api/AuthRouter");
const cartsRouter = require("./api/CartsRouter");
const couponCodesRouter = require("./api/CouponCodesRouter");
const deliveryRouter = require("./api/DeliveryRouter"); // Corrected path
const favouritesRouter = require("./api/FavouritesRouter");
const itemCategoriesRouter = require("./api/ItemCategoriesRouter");
const itemsRouter = require("./api/ItemsRouter");
const notificationsRouter = require("./api/NotificationsRouter");
const ordersRouter = require("./api/OrdersRouter");
const restaurantsRouter = require("./api/RestaurantsRouter");
const slidersRouter = require("./api/SlidersRouter");
const superCategoriesRouter = require("./api/SuperCategoriesRouter");
const subCategoriesRouter = require("./api/SubCategoriesRouter"); // Import the new router
const systemRouter = require("./api/SystemRouter");
const usersRouter = require("./api/UsersRouter");

// Use all routers, sorted alphabetically
router.use('/address', addressRouter);
router.use('/admins', adminsRouter);
router.use('/agents', agentsRouter);
router.use('/auth', authRouter);
router.use('/carts', cartsRouter);
router.use('/coupon_codes', couponCodesRouter);
router.use('/delivery', deliveryRouter);
router.use('/favourites', favouritesRouter);
router.use('/item_categories', itemCategoriesRouter);
router.use('/items', itemsRouter);
router.use('/notifications', notificationsRouter);
router.use('/orders', ordersRouter);
router.use('/restaurants', restaurantsRouter);
router.use('/sliders', slidersRouter);
router.use('/super_categories', superCategoriesRouter);
router.use('/sub_categories', subCategoriesRouter); // Register the new route
router.use('/system', systemRouter);
router.use('/users', usersRouter);

module.exports = router;
