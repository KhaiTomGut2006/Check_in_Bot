// models/SharedSchemas.js (or inside your User/Action file)
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Defined as a sub-document (no _id needed)
const DiscordRoleSchema = new Schema({
    name: { type: String, required: true },
    id: { type: String, required: true }, // Discord Snowflake as String
    color: { type: String, default: '#99AAB5' }, // Hex color (e.g., #FFFFFF)
    position: { type: Number, required: true },
}, { _id: false });

module.exports = { DiscordRoleSchema };