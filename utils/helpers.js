const Member = require('../models/Member');
const axios = require('axios');

async function generateUniqueId() {
  let isUnique = false;
  let newId = "";
  while (!isUnique) {
    newId = Math.floor(10000 + Math.random() * 90000).toString();
    const existing = await Member.findOne({ id: newId });
    if (!existing) isUnique = true;
  }
  return newId;
}

async function generateUniqueCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let isUnique = false;
  let newCode = "";
  while (!isUnique) {
    newCode = "";
    for (let i = 0; i < 4; i++) {
      newCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const existing = await Member.findOne({ code: newCode });
    if (!existing) isUnique = true;
  }
  return newCode;
}

function cleanUserData(text) {
  if (!text) return "";
  let cleaned = text;
  const patterns = [
    /(ครับผม|ครับ|ค่ะ|คับ|ka|krub|จ้า|จ้ะ|นะจ๊ะ|นะคะ|นะ)/gi,
    /(ชื่อ[- ]?นามสกุล|ชื่อจริง|นามสกุล|ชื่อเล่น|ชื่อ)/gi,
    /(เบอร์โทร|เบอร์|โทร|tel)/gi,
    /(line id|line|ไลน์|ไอดี)/gi
  ];
  patterns.forEach(pattern => { cleaned = cleaned.replace(pattern, ''); });
  cleaned = cleaned.replace(/^[:\-\s=]+|[:\-\s=]+$/g, '');
  return cleaned.trim().replace(/\s+/g, ' ');
}

async function sendDataToWebApp(data, retryCount = 0) {
  const maxRetries = 5;
  try {
    const WEB_APP_URL = process.env.POST_APP_URL;
    if (!WEB_APP_URL) return null;

    const response = await axios.post(WEB_APP_URL, data);
    console.log('Successfully sent data to Web App:', response.data);
    return response.data.row;
  } catch (error) {
    if (error.response && (error.response.status === 429 || error.response.status >= 500)) {
      if (retryCount < maxRetries) {
        const waitTime = 2000 * (retryCount + 1);
        console.log(`⚠️ Google Sheets Busy, retrying... (${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return sendDataToWebApp(data, retryCount + 1);
      }
    }
    console.error('Error sending data to Web App:', error.message);
    return null;
  }
}

module.exports = {
    generateUniqueId,
    generateUniqueCode,
    cleanUserData,
    sendDataToWebApp
};