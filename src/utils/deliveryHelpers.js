/**
 * Delivery Helper Functions
 * Contains shared utility functions for delivery calculations
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - First point latitude
 * @param {number} lon1 - First point longitude
 * @param {number} lat2 - Second point latitude
 * @param {number} lon2 - Second point longitude
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Calculate estimated delivery time based on distance
 * @param {number} distance - Distance in kilometers
 * @returns {number} Estimated time in minutes
 */
const calculateEstimatedTime = (distance) => Math.ceil((distance / 30) * 60); // Assuming average speed of 30 km/h

/**
 * Calculate delivery fee based on distance and order type
 * @param {number} distance - Distance in kilometers
 * @param {string} orderType - "Single" or "Multi"
 * @returns {number} Delivery fee in EGP
 */
const calculateDeliveryFee = (distance, orderType) => {
    const baseDistance = 3; // 3 كم
    if (orderType === "Single") {
        const baseFee = 15; // 15 جنيه
        const extraKmCharge = 4; // 4 جنيه لكل كم إضافي
        if (distance <= baseDistance) return baseFee;
        return baseFee + Math.ceil(distance - baseDistance) * extraKmCharge;
    } else { // Multi
        const baseFee = 25; // 25 جنيه
        const extraKmCharge = 5; // 5 جنيه لكل كم إضافي
        if (distance <= baseDistance) return baseFee;
        return baseFee + Math.ceil(distance - baseDistance) * extraKmCharge;
    }
};

/**
 * Calculate maximum distance from user to any restaurant in the order
 * @param {Array} restaurants - Array of restaurant objects with coordinates
 * @param {Object} userAddress - User address with coordinates {latitude, longitude}
 * @returns {number} Maximum distance in kilometers
 */
const calculateMaxDistanceToRestaurants = (restaurants, userAddress) => {
    let maxDistance = 0;
    
    for (const restaurant of restaurants) {
        const distance = calculateDistance(
            restaurant.coordinates.latitude,
            restaurant.coordinates.longitude,
            userAddress.latitude,
            userAddress.longitude
        );
        
        if (distance > maxDistance) {
            maxDistance = distance;
        }
    }
    
    return maxDistance;
};

module.exports = {
    calculateDistance,
    calculateEstimatedTime,
    calculateDeliveryFee,
    calculateMaxDistanceToRestaurants
};
