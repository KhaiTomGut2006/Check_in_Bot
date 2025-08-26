const { Client, GatewayIntentBits, Events, Partials } = require('discord.js');
const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;

const client = new Client({
  intents: [GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.MessageContent,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel]
});

async function sendDataToWebApp(data) {
  try {
    const WEB_APP_URL = process.env.WEB_APP_URL;
    if (!WEB_APP_URL) {
      console.error("WEB_APP_URL is not defined in .env file!");
      return;
    }

    const response = await axios.post(WEB_APP_URL, data);
    console.log(' Successfully sent data to Web App:', response.data);
  }
  catch (error) {
    console.error(' Error sending data to Web App:', error.message);
  }
}


async function askQuestion(channel, userId, question) {
  await channel.send(question);

  const filter = m => m.author.id === userId && m.channelId === channel.id;

  const collected = await channel.awaitMessages({
    filter,
    max: 1
  });

  return collected.first().content;
}

client.on('clientReady', () => {
  console.log(`logged in as ${client.user.tag}`)
});

//ตรวจสอบคนที่เข้ามาใหม่
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const dm = await member.createDM();

    await dm.send(`### โย่ว  @${member.user.username} ว่าไงไอน้อง ก่อนเราจะไปลุยกันในดิสพี่ขอถามอะไรหน่อย`);
    await dm.send("### อย่างแรกถ้าเห็นข้อความนี้แล้วอยากให้น้องช่วยตอบคำถามนิดหน่อย ช่วยตอบตามความจริงด้วยน้าเพราะมีผลต่อการส่งต่อคอร์สเรียนของน้องนะเว้ยย");
    const name = await askQuestion(dm, member.id, "ไหนขอ ชื่อ-นามสกุล เราหน่อย")
    const nickname = await askQuestion(dm, member.id, "เอ้ย ลืมถามชื่อเล่นขอลชื่อเล่นหน่อย")
    const q1 = await askQuestion(dm, member.id, "ไปเจอกิจกรรมนี้จากไหนอ่ะ เช่นแบบ TikTok , CampHub");
    const q2 = await askQuestion(dm, member.id, "เรียนแล้วอยากทำไรต่อออ เช่นแบบ อยากเข้าคณะอะไรมหาลัยไหน");
    const q3 = await askQuestion(dm, member.id, "เคยเรียนหรือทำไรมาก่อนป่าว เช่น สร้างเกม Roblox เคยเขียนโค้ดจากที่โรงเรียนงี้");

    await dm.send("แจ๋วเลย สรุปคำตอบของน้องคือ:");
    await dm.send(`แหล่งที่เจอ: ${q1}\n• เป้าหมาย: ${q2}\n• พื้นฐาน: ${q3}`);

    const dataToSend = {
      name: name,
      nickname: nickname,
      source: q1,
      goal: q2,
      background: q3
    };

    await sendDataToWebApp(dataToSend);
    await dm.send("ข้อมูลของน้องถูกบันทึกเรียบร้อยแล้ว ยินดีต้อนรับเข้าสู่เซิร์ฟเวอร์!");

  } catch (err) {
    console.error("ส่ง DM ไม่สำเร็จหรือรอข้อความล้มเหลว:", err);
  }
});

client.login(token);