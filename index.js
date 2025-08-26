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

  } catch (err) {
    console.error("ส่ง DM ไม่สำเร็จหรือรอข้อความล้มเหลว:", err);
  }
});

client.login(token);