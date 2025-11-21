const express = require('express');
const cors = require('cors');
const SystemConfig = require('../models/SystemConfig');
const CourseConfig = require('../models/CourseConfig');
const { loadConfig } = require('../utils/configLoader');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/common-questions', async (req, res) => {
    const config = await SystemConfig.findOne({ configName: 'maincheckin_config' });
    res.json(config ? config.commonQuestions : []);
});

app.post('/api/common-questions', async (req, res) => {
    await SystemConfig.findOneAndUpdate(
        { configName: 'maincheckin_config' }, 
        { commonQuestions: req.body.questions },
        { upsert: true }
    );
    await loadConfig(); // Reload Shared State
    res.json({ success: true });
});

app.get('/api/courses', async (req, res) => {
    const courses = await CourseConfig.find({});
    res.json(courses);
});

app.post('/api/courses', async (req, res) => {
    const { emoji, data } = req.body;
    await CourseConfig.findOneAndUpdate(
        { emoji: emoji },
        data,
        { upsert: true, new: true }
    );
    await loadConfig(); // Reload Shared State
    res.json({ success: true });
});

app.delete('/api/courses/:emoji', async (req, res) => {
    await CourseConfig.deleteOne({ emoji: req.params.emoji });
    await loadConfig(); // Reload Shared State
    res.json({ success: true });
});

module.exports = { app };