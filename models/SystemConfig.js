const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema({
    configName: { type: String, default: 'maincheckin_config', unique: true },
    commonQuestions: [{ key: String, question: String }]
});

// 👇 แก้บรรทัดสุดท้าย ให้เติม 'checkinsystemconfigs'
module.exports = mongoose.model('SystemConfig', SystemConfigSchema, 'checkinsystemconfigs');