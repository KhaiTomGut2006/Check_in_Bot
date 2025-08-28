const { Client, GatewayIntentBits, Events, Partials, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;

const prefix = "!";

//เพิ่มยศตรงนี้
const reactionRoleConfig = {
  "👑": '1410273521766109255'
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions
  ],

  partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});


const reactionSessions = new Map();

async function sendDataToWebApp(data) {
  try {
    const WEB_APP_URL = process.env.WEB_APP_URL;
    if (!WEB_APP_URL) {
      console.error("WEB_APP_URL is not defined in .env file!");
      return;
    }
    const response = await axios.post(WEB_APP_URL, data);
    console.log(' Successfully sent data to Web App:', response.data);
  } catch (error) {
    console.error(' Error sending data to Web App:', error.message);
  }
}


async function sendRoleRequest(channel) {
  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('เลือกยศตามคอร์สที่น้องสมัคร!')
    .setDescription(
      'น้องมาเข้ากิจกรรมไหนก็กดอิโมจิตามที่สมัครเข้ามาได้เลยจ้า\n\n' +
      '👑 - NuuTorCup\n'
    )
    .setFooter({ text: 'เลือกให้ดีอย่าเลือกผิดนะไอน้อง' });

  const roleMessage = await channel.send({ embeds: [embed] });

  try {
    for (const emoji of Object.keys(reactionRoleConfig)) {
      await roleMessage.react(emoji);
    }
  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการเพิ่ม Reaction", error);
  }

  return roleMessage;
}

async function askQuestion(channel, userId, question) {
  await channel.send(question);
  const filter = m => m.author.id === userId && m.channelId === channel.id;
  const collected = await channel.awaitMessages({ filter, max: 1 });
  return collected.first().content;
}

client.on(Events.ClientReady, () => {
  console.log(`logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.content === prefix + "checkin") {
    try {
      const member = message.member;
      const dm = await member.createDM();

      await message.reply("พี่ส่งคำถามไปใน DM แล้วนะ ไปเช็คกันเลย!");

      await dm.send(`### โย่ว @${member.user.username} ว่าไงไอน้อง ก่อนเราจะไปลุยกันในดิสพี่ขอถามอะไรหน่อย`);
      await dm.send("### อย่างแรกถ้าเห็นข้อความนี้แล้วอยากให้น้องช่วยตอบคำถามนิดหน่อย...");
      const name = await askQuestion(dm, member.id, "ไหนขอ ชื่อ-นามสกุล เราหน่อย");
      const nickname = await askQuestion(dm, member.id, "เอ้ย ลืมถามชื่อเล่นของชื่อเล่นหน่อย");
      const q1 = await askQuestion(dm, member.id, "ไปเจอกิจกรรมนี้จากไหนอ่ะ เช่นแบบ TikTok , CampHub");
      const q2 = await askQuestion(dm, member.id, "เรียนแล้วอยากทำไรต่อออ เช่นแบบ อยากเข้าคณะอะไรมหาลัยไหน");
      const q3 = await askQuestion(dm, member.id, "เคยเรียนหรือทำไรมาก่อนป่าว เช่น สร้างเกม Roblox เคยเขียนโค้ดจากที่โรงเรียนงี้");
      const why = await askQuestion(dm, member.id, "เคยเรียนหรือทำไรมาก่อนป่าว เช่น สร้างเกม Roblox เคยเขียนโค้ดจากที่โรงเรียนงี้");


      await dm.send("แจ๋วเลย สรุปคำตอบของน้องคือ:");
      await dm.send(`• แหล่งที่เจอ: ${q1}\n• เป้าหมาย: ${q2}\n• พื้นฐาน: ${q3}`);

      const dataToSend = {
        Name_Surname: name,
        Nickname: nickname,
        Why: why,
        From: q1,
        Goal: q2,
        Basic: q3
      };


      await dm.send("ขั้นตอนสุดท้ายคือการเลือกยศนะ!");

      // ส่งข้อความเลือกยศ และบันทึกเซสชัน
      const roleMessage = await sendRoleRequest(dm);
      reactionSessions.set(roleMessage.id, {
        guildId: member.guild.id,
        userId: member.id
      });
      await sendDataToWebApp(dataToSend);
      await dm.send("ข้อมูลของน้องถูกบันทึกเรียบร้อยแล้ว ");
    } catch (err) {
      console.error("ส่ง DM ไม่สำเร็จหรือรอข้อความล้มเหลว:", err);
      await message.reply("อ๊ะ! พี่ส่ง DM ไปหาน้องไม่ได้แฮะ ลองเช็คการตั้งค่าความเป็นส่วนตัวแล้วลองอีกครั้งนะ");
    }
  }
});


client.on(Events.MessageReactionAdd, async (reaction, user) => {
  console.log("อิโมจิทำงาน");
  if (reaction.partial) {
    try {
      console.log("fetching reaction!!");
      await reaction.fetch();
    } catch (error) {
      console.error('Something went wrong when fetching the message:', error);
      return;
    }
  }
  if (user.bot) return;

  const session = reactionSessions.get(reaction.message.id);

  if (session && session.userId === user.id) {
    const emoji = reaction.emoji.name;
    const roleId = reactionRoleConfig[emoji];

    if (roleId) {
      try {
        // ใช้ guildId ที่เก็บไว้เพื่อหาเซิร์ฟเวอร์
        const guild = await client.guilds.fetch(session.guildId);
        if (!guild) return;

        // ใช้ userId เพื่อหา member ในเซิร์ฟเวอร์นั้น
        const member = await guild.members.fetch(session.userId);
        if (!member) return;

        const role = guild.roles.cache.get(roleId);
        console.log(`[DEBUG] Attempting to find role. Role ID: ${roleId}. Found role:`, role ? role.name : 'Not Found');
        if (!role) return;

        await member.roles.add(role);
        console.log(`เพิ่มยศ '${role.name}' ให้กับ ${user.tag} ในเซิร์ฟเวอร์ ${guild.name}`);

        await user.send(`รับทราบ! พี่ได้มอบยศ **${role.name}** ให้เรียบร้อยแล้วในเซิร์ฟเวอร์ **${guild.name}**`);

        // ลบเซสชันออกเมื่อทำงานเสร็จ
        reactionSessions.delete(reaction.message.id);

      } catch (error) {
        console.error('เกิดข้อผิดพลาดในการเพิ่มยศจาก DM:', error);
      }
    }
  }
});

client.login(token);
