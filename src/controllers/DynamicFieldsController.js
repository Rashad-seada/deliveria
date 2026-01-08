/**
 * Dynamic Fields Controller
 * Handles custom form fields for flexible data collection
 */

const DynamicField = require("../models/DynamicField");

/**
 * Creates a new dynamic field
 */
module.exports.createDynamicField = async (req, res) => {
    try {
        const {
            entity_type,
            entity_id,
            field_name,
            display_name,
            field_type,
            required = false,
            validation_rules,
            value
        } = req.body;

        // Validate required fields
        const required_fields = ['entity_type', 'entity_id', 'field_name', 'display_name', 'field_type'];
        const missing = required_fields.filter(field => !req.body[field]);

        if (missing.length > 0) {
            return res.status(400).json({
                message: `Missing required fields: ${missing.join(', ')}`
            });
        }

        // Validate entity type
        const valid_entity_types = ['User', 'Restaurant', 'Order', 'Item', 'Address'];
        if (!valid_entity_types.includes(entity_type)) {
            return res.status(400).json({
                message: `Invalid entity type. Must be one of: ${valid_entity_types.join(', ')}`
            });
        }

        // Validate field type
        const valid_field_types = ['text', 'email', 'phone', 'number', 'date', 'checkbox', 'select', 'textarea', 'file', 'url'];
        if (!valid_field_types.includes(field_type)) {
            return res.status(400).json({
                message: `Invalid field type. Must be one of: ${valid_field_types.join(', ')}`
            });
        }

        // Check if field already exists
        const existing = await DynamicField.findOne({
            entity_type,
            entity_id,
            field_name
        });

        if (existing) {
            return res.status(400).json({
                message: `Field ${field_name} already exists for this entity`
            });
        }

        const dynamicField = new DynamicField({
            entity_type,
            entity_id,
            field_name,
            display_name,
            field_type,
            required,
            validation_rules: validation_rules || {},
            value
        });

        await dynamicField.save();

        return res.status(201).json({
            message: "Dynamic field created successfully",
            field: dynamicField
        });
    } catch (error) {
        console.error("Error creating dynamic field:", error);
        return res.status(500).json({ message: "Error creating dynamic field", error: error.message });
    }
};

/**
 * Gets all fields for an entity
 */
module.exports.getEntityFields = async (req, res) => {
    try {
        const { entity_type, entity_id } = req.query;

        if (!entity_type || !entity_id) {
            return res.status(400).json({ message: "entity_type and entity_id are required" });
        }

        const fields = await DynamicField.find({
            entity_type,
            entity_id,
            is_visible: true
        }).sort({ display_order: 1 });

        return res.json({
            count: fields.length,
            fields
        });
    } catch (error) {
        console.error("Error fetching entity fields:", error);
        return res.status(500).json({ message: "Error fetching entity fields", error: error.message });
    }
};

/**
 * Gets a specific field
 */
module.exports.getFieldById = async (req, res) => {
    try {
        const { fieldId } = req.params;

        const field = await DynamicField.findById(fieldId);

        if (!field) {
            return res.status(404).json({ message: "Field not found" });
        }

        return res.json({ field });
    } catch (error) {
        console.error("Error fetching field:", error);
        return res.status(500).json({ message: "Error fetching field", error: error.message });
    }
};

/**
 * Updates a dynamic field
 */
module.exports.updateDynamicField = async (req, res) => {
    try {
        const { fieldId } = req.params;
        const updateData = req.body;

        const field = await DynamicField.findByIdAndUpdate(
            fieldId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!field) {
            return res.status(404).json({ message: "Field not found" });
        }

        return res.json({
            message: "Field updated successfully",
            field
        });
    } catch (error) {
        console.error("Error updating field:", error);
        return res.status(500).json({ message: "Error updating field", error: error.message });
    }
};

/**
 * Updates field value
 */
module.exports.updateFieldValue = async (req, res) => {
    try {
        const { fieldId } = req.params;
        const { value } = req.body;

        const field = await DynamicField.findByIdAndUpdate(
            fieldId,
            { value },
            { new: true }
        );

        if (!field) {
            return res.status(404).json({ message: "Field not found" });
        }

        // Validate value against rules
        const validation = validateFieldValue(field, value);
        if (!validation.valid) {
            return res.status(400).json({
                message: "Validation failed",
                error: validation.error
            });
        }

        return res.json({
            message: "Field value updated successfully",
            field
        });
    } catch (error) {
        console.error("Error updating field value:", error);
        return res.status(500).json({ message: "Error updating field value", error: error.message });
    }
};

/**
 * Deletes a dynamic field
 */
module.exports.deleteDynamicField = async (req, res) => {
    try {
        const { fieldId } = req.params;

        const field = await DynamicField.findByIdAndDelete(fieldId);

        if (!field) {
            return res.status(404).json({ message: "Field not found" });
        }

        return res.json({ message: "Field deleted successfully" });
    } catch (error) {
        console.error("Error deleting field:", error);
        return res.status(500).json({ message: "Error deleting field", error: error.message });
    }
};

/**
 * Bulk create fields for an entity
 */
module.exports.bulkCreateFields = async (req, res) => {
    try {
        const { entity_type, entity_id, fields } = req.body;

        if (!entity_type || !entity_id || !Array.isArray(fields)) {
            return res.status(400).json({ message: "entity_type, entity_id, and fields array are required" });
        }

        const created = [];
        const errors = [];

        for (const field of fields) {
            try {
                const dynamicField = new DynamicField({
                    entity_type,
                    entity_id,
                    ...field
                });
                await dynamicField.save();
                created.push(dynamicField);
            } catch (error) {
                errors.push({
                    field_name: field.field_name,
                    error: error.message
                });
            }
        }

        return res.status(201).json({
            message: 'Bulk create completed',
            created: created.length,
            failed: errors.length,
            fields: created,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        console.error("Error bulk creating fields:", error);
        return res.status(500).json({ message: "Error bulk creating fields", error: error.message });
    }
};

/**
 * Gets fields of a specific type
 */
module.exports.getFieldsByType = async (req, res) => {
    try {
        const { entity_type } = req.query;

        if (!entity_type) {
            return res.status(400).json({ message: "entity_type is required" });
        }

        const fields = await DynamicField.find({ entity_type }).sort({ display_order: 1 });

        return res.json({
            count: fields.length,
            fields
        });
    } catch (error) {
        console.error("Error fetching fields by type:", error);
        return res.status(500).json({ message: "Error fetching fields by type", error: error.message });
    }
};

/**
 * Helper function to validate field value
 */
function validateFieldValue(field, value) {
    const rules = field.validation_rules || {};

    // Check required
    if (field.required && !value) {
        return { valid: false, error: `${field.display_name} is required` };
    }

    // Check field type specific validation
    switch (field.field_type) {
        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (value && !emailRegex.test(value)) {
                return { valid: false, error: 'Invalid email format' };
            }
            break;
        case 'phone':
            const phoneRegex = /^[0-9]{10,}$/;
            if (value && !phoneRegex.test(value)) {
                return { valid: false, error: 'Invalid phone format' };
            }
            break;
        case 'number':
            if (value && isNaN(value)) {
                return { valid: false, error: 'Value must be a number' };
            }
            if (value && rules.min_value && value < rules.min_value) {
                return { valid: false, error: `Value must be at least ${rules.min_value}` };
            }
            if (value && rules.max_value && value > rules.max_value) {
                return { valid: false, error: `Value must not exceed ${rules.max_value}` };
            }
            break;
        case 'text':
        case 'textarea':
            if (value && rules.min_length && value.length < rules.min_length) {
                return { valid: false, error: `Minimum length is ${rules.min_length}` };
            }
            if (value && rules.max_length && value.length > rules.max_length) {
                return { valid: false, error: `Maximum length is ${rules.max_length}` };
            }
            if (value && rules.pattern && !new RegExp(rules.pattern).test(value)) {
                return { valid: false, error: `Value does not match required pattern` };
            }
            break;
        case 'select':
            if (value && rules.allowed_values && !rules.allowed_values.includes(value)) {
                return { valid: false, error: `Invalid value. Must be one of: ${rules.allowed_values.join(', ')}` };
            }
            break;
    }

    return { valid: true };
}

module.exports.validateFieldValue = validateFieldValue;
