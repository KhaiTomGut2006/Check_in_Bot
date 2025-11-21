const mongoose = require('mongoose');

const CourseConfigSchema = new mongoose.Schema({
    emoji: { type: String, unique: true },
    roleId: String,
    courseName: String,
    displayName: String,
    sheetName: String,
    specificQuestions: [{ key: String, question: String }]
});

module.exports = mongoose.model('CourseConfig', CourseConfigSchema, 'checkincourseconfigs');