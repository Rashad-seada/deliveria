const router = require("express").Router();
const { checkToken } = require("../../auth/token_validation");
const subCategoriesController = require("../../controllers/SubCategoriesController");

// Create a new sub-category (Admin only)
router.post("/create", checkToken, subCategoriesController.createSubCategory);

// Get all sub-categories
router.get("/", subCategoriesController.getAllSubCategories);

// Get all sub-categories for a specific super-category
router.get("/:super_category_id", subCategoriesController.getSubCategoriesBySuper);

// Update a sub-category (Admin only)
router.put("/:id", checkToken, subCategoriesController.updateSubCategory);

// Delete a sub-category (Admin only)
router.delete("/:id", checkToken, subCategoriesController.deleteSubCategory);

module.exports = router;