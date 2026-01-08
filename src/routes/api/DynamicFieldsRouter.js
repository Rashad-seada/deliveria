const router = require('express').Router();
const DynamicFieldsController = require('../../controllers/DynamicFieldsController');
const { checkToken } = require('../../auth/token_validation');

// Create a new dynamic field
router.post('/', checkToken, DynamicFieldsController.createDynamicField);

// Bulk create fields
router.post('/bulk-create', checkToken, DynamicFieldsController.bulkCreateFields);

// Get all fields for an entity
router.get('/entity', DynamicFieldsController.getEntityFields);

// Get fields by entity type
router.get('/type', DynamicFieldsController.getFieldsByType);

// Get specific field
router.get('/:fieldId', DynamicFieldsController.getFieldById);

// Update field
router.put('/:fieldId', checkToken, DynamicFieldsController.updateDynamicField);

// Update field value
router.patch('/:fieldId/value', checkToken, DynamicFieldsController.updateFieldValue);

// Delete field
router.delete('/:fieldId', checkToken, DynamicFieldsController.deleteDynamicField);

module.exports = router;
