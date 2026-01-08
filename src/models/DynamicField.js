const mongoose = require("mongoose");
const Schema = mongoose.Schema;

/**
 * Dynamic Fields Model - Allows flexible custom fields in forms
 * Uses EAV (Entity-Attribute-Value) pattern for flexibility
 */
const dynamicFieldSchema = new Schema(
    {
        // Which entity/form this field belongs to
        entity_type: {
            type: String,
            enum: ["User", "Restaurant", "Order", "Item", "Address"],
            required: true
        },
        entity_id: {
            type: Schema.Types.ObjectId,
            required: true,
            description: "ID of the entity this field belongs to"
        },
        // Field definition
        field_name: {
            type: String,
            required: true,
            lowercase: true
        },
        display_name: {
            type: String,
            required: true,
            description: "Human-readable field name"
        },
        field_type: {
            type: String,
            enum: ["text", "email", "phone", "number", "date", "checkbox", "select", "textarea", "file", "url"],
            required: true
        },
        // Field metadata
        required: {
            type: Boolean,
            default: false
        },
        validation_rules: {
            min_length: Number,
            max_length: Number,
            pattern: String,      // Regex pattern
            min_value: Number,
            max_value: Number,
            allowed_values: [String] // For select fields
        },
        // Field value
        value: Schema.Types.Mixed, // Can store any type of value
        // File field specific
        file_url: String,
        file_size: Number,
        file_type: String,
        // Display configuration
        display_order: Number,
        is_visible: {
            type: Boolean,
            default: true
        },
        is_editable: {
            type: Boolean,
            default: true
        },
        help_text: String,
        placeholder: String
    },
    { timestamps: true }
);

// Composite index for efficient querying
dynamicFieldSchema.index({ entity_type: 1, entity_id: 1, field_name: 1 }, { unique: true });

const DynamicField = mongoose.model("DynamicField", dynamicFieldSchema);
module.exports = DynamicField;
