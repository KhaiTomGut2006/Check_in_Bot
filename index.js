const { Client, GatewayIntentBits, Events, Partials, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;

const prefix = "!";

const courseConfig = {
  "⭐": { // Key คือ Emoji ที่บอกจะโชว์ให้เด็กเลือกยศ
    roleId: '1388546120912998554',
    courseName: 'THREE-', // ชื่อสำหรับ Template Nickname
    displayName: 'Starways', // ชื่อสำหรับแสดงผลใน Embed
    sheetName: 'Starways' // << ชื่อชีตใน Google Sheets ที่จะบันทึกข้อมูล
  },
  "🎮":{
    roleId: '1388489027627253852',
    courseName : 'MGWA',
    displayName : 'MadeGameWithAI',
    sheetName : 'MadeGameWithAI'
  },
  "⚒️":{
    roleId: '1398550643031150722',
    courseName : 'PFP',
    displayName : 'Project For Portfolio',
    sheetName : 'PFP'
  }

  // --- ตัวอย่างการเพิ่มคอร์ส ---
  /*
  "🚀": { 
    roleId: 'ANOTHER_ROLE_ID',
    courseName: 'DevCamp',
    displayName: 'Developer Camp',
    sheetName: 'DevCamp_Registrations'
  }
  */
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
      return null;
    }
    const response = await axios.post(WEB_APP_URL, data);
    console.log('Successfully sent data to Web App:', response.data);
    return response.data.row;
  } catch (error) {
    console.error('Error sending data to Web App:', error.message);
    return null;
  }
}

async function sendRoleRequest(channel) {
  // สร้าง Description ของ Embed จาก courseConfig โดยอัตโนมัติ
  let description = 'น้องมาเข้ากิจกรรมไหนก็กดอิโมจิตามที่สมัครเข้ามาได้เลยจ้า\n\n';
  for (const emoji in courseConfig) {
    description += `${emoji} - ${courseConfig[emoji].displayName}\n`;
  }

  const embed = new EmbedBuilder()
    .setColor('#0099ff')
    .setTitle('เลือกยศตามคอร์สที่น้องสมัคร!')
    .setDescription(description)
    .setFooter({ text: 'เลือกให้ดีอย่าเลือกผิดนะไอน้อง' });

  const roleMessage = await channel.send({ embeds: [embed] });

  try {
    for (const emoji of Object.keys(courseConfig)) {
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

// --- [แก้ไข] ส่วน !checkin จะทำหน้าที่เก็บข้อมูลเท่านั้น ---
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.content === prefix + "checkin") {
    try {
      const member = message.member;
      const dm = await member.createDM();
      
      await dm.send(`### โย่ว @${member.user.username} ว่าไงไอน้อง ก่อนเราจะไปลุยกันในดิสพี่ขอถามอะไรหน่อย`);
      await dm.send("### อย่างแรกถ้าเห็นข้อความนี้แล้วอยากให้น้องช่วยตอบคำถามนิดหน่อยตั้งใจตอบนะเพราะคำตอบมีผลต่อการต่อคอร์สของน้องในอนาคต");
      const name = await askQuestion(dm, member.id, "ไหนขอ ชื่อ-นามสกุล เราหน่อย  \n[ตัวอย่างคำตอบ: นาย แฮมเต้อ หล่อดี]");
      const nickname = await askQuestion(dm, member.id, "เอ้ย ลืมถามชื่อเล่นของชื่อเล่นหน่อย  \n[ตัวอย่างคำตอบ: โฟกัส]");
      const age = await askQuestion(dm, member.id, "อายุเท่าใหร่วะน้อง  \n[ตัวอย่างคำตอบ: 18]");
      const q1 = await askQuestion(dm, member.id, "ไปเจอกิจกรรมนี้จากไหนอ่ะ เช่นแบบ TikTok , CampHub  \n[ตัวอย่างคำตอบ: TikTok , IG ]");
      const why = await askQuestion(dm, member.id, "จากข้อที่แล้วอะไรในตัวโฆษณาที่แบบทำให้เราตัดสินใจสมัครมา เช่น ชอบเนื้อหาในคลิป , โปรโมชั่นน่าสนใจ , ชอบในตัวคอร์ส  \n[ตัวอย่างคำตอบ: สมัครเพราะเห็นว่าในคลิปบอกว่ามีรุ่นพี่ช่วยให้คำปรึกษาได้บลาๆ ]");
      const q2 = await askQuestion(dm, member.id, "เรียนแล้วอยากทำไรต่อออ เช่นแบบ อยากเข้าคณะอะไรมหาลัยไหน  \n[ตัวอย่างคำตอบ: วิศวะคอมพิวเตอร์ ม.มหิดล ]");
      const q3 = await askQuestion(dm, member.id, "เคยเรียนหรือทำไรมาก่อนป่าว เช่น สร้างเกม Roblox เคยเขียนโค้ดจากที่โรงเรียนงี้  \n[ตัวอย่างคำตอบ: เคยเขียนPythonมาจากโรงเรียน ]");
      const project = await askQuestion(dm, member.id, "ละน้องมีโปรเจคที่อยากทำมั้ย ถ้าตอนนี้คิดไม่ออกเดี๋ยวจบกิจกรรมมาบอกพี่ก็ได้แบบ อยากทำโปรเจคแนวไหน เล่าไอเดียให้ฟังหน่อย");
      const line = await askQuestion(dm,member.id,"สุดท้ายละๆๆ ไลน์ที่เราใช้สมัครมาชื่ออะไรนะ \n[ตัวอย่างคำตอบ : พิมพ์แค่ชื่อ Account ไลน์ของน้อง ]");
      
      await dm.send("แจ๋วเลย");

      // เก็บข้อมูลทั้งหมดไว้ใน Object เพื่อรอการเลือกยศ
      const collectedData = {
        UserId: member.id, // Include userId in the data
        Name_Surname: name,
        Nickname: nickname,
        Age: age,
        Why: why,
        From: q1,
        Goal: q2,
        Basic: q3,
        Project: project,
        Line : line
      };

      // Send data to the Web App
      const rowNumber = await sendDataToWebApp(collectedData);

      if (!rowNumber) {
        await dm.send("ขออภัย! เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาติดต่อแอดมิน");
        return;
      }

      await dm.send("ข้อมูลของน้องถูกบันทึกเรียบร้อยแล้ว!");

      // ส่งข้อความเลือกยศ และบันทึกข้อมูลที่เก็บมาทั้งหมดลงใน session
      const roleMessage = await sendRoleRequest(dm);
      reactionSessions.set(roleMessage.id, {
        guildId: member.guild.id,
        userId: member.id,
        collectedData: collectedData // เก็บข้อมูลทั้งหมดไว้ที่นี่
      });

    } catch (err) {
      console.error("ส่ง DM ไม่สำเร็จหรือรอข้อความล้มเหลว:", err);
      await message.reply("อ๊ะ! พี่ส่ง DM ไปหาน้องไม่ได้แฮะ ลองเช็คการตั้งค่าความเป็นส่วนตัวแล้วลองอีกครั้งนะ");
    }
  }
});

// --- [แก้ไข] ส่วน ReactionAdd จะเป็นศูนย์กลางการทำงานทั้งหมด ---
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.partial) {
    try {
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
    const selectedCourse = courseConfig[emoji]; // ดึงข้อมูลคอร์สที่เลือกจาก Config

    if (selectedCourse) {
      try {
        await user.send("รับทราบ! กำลังดำเนินการบันทึกข้อมูลและให้ยศ... กรุณารอสักครู่");

        // 1. เตรียมข้อมูลและส่งไปที่ Google Sheet
        const dataToSend = {
          ...session.collectedData, // นำข้อมูลคำตอบทั้งหมดออกมา
          SheetName: selectedCourse.sheetName // เพิ่มชื่อชีตที่ต้องการบันทึกเข้าไป
        };

        const rowNumber = await sendDataToWebApp(dataToSend);

        if (!rowNumber) {
          await user.send("ขออภัย! เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาติดต่อแอดมิน");
          reactionSessions.delete(reaction.message.id); // ลบเซสชันที่ล้มเหลว
          return;
        }

        // 2. ให้ยศและเปลี่ยนชื่อเล่น
        const guild = await client.guilds.fetch(session.guildId);
        if (!guild) return;
        const member = await guild.members.fetch(session.userId);
        if (!member) return;
        const role = guild.roles.cache.get(selectedCourse.roleId);
        if (!role) {
            console.error(`ไม่พบยศที่มี ID: ${selectedCourse.roleId}`);
            await user.send("เกิดข้อผิดพลาด: ไม่พบยศที่กำหนดไว้ในเซิร์ฟเวอร์ กรุณาติดต่อแอดมิน");
            return;
        }
        
        await member.roles.add(role);
        console.log(`เพิ่มยศ '${role.name}' ให้กับ ${user.tag}`);

        try {
          const finalNumber = rowNumber - 1;
          const formattedNumber = String(finalNumber).padStart(2, '0');
          const nickname = session.collectedData.Nickname;
          const newNickname = `${selectedCourse.courseName}-${formattedNumber} ${nickname}`;

          await member.setNickname(newNickname);
          console.log(`เปลี่ยนชื่อเล่นของ ${user.tag} เป็น "${newNickname}"`);
        } catch (nicknameError) {
          console.error(`ไม่สามารถเปลี่ยนชื่อเล่นได้:`, nicknameError);
          await user.send(`พี่ให้ยศเรียบร้อยแล้ว แต่เปลี่ยนชื่อเล่นให้ไม่ได้แฮะ อาจจะเพราะยศพี่ไม่สูงพอ หรือชื่อยาวเกินไป`);
        }
        
        // 3. แจ้งผลสำเร็จและลบเซสชัน
        await user.send(`สำเร็จ! พี่ได้มอบยศ **${role.name}** และตั้งชื่อเล่นให้เรียบร้อยแล้วในเซิร์ฟเวอร์ **${guild.name}**`);
        reactionSessions.delete(reaction.message.id);

      } catch (error) {
        console.log(`เกิดปัญหาในขั้นตอนสุดท้าย: ${error}`);
        await user.send("เกิดข้อผิดพลาดร้ายแรง กรุณาติดต่อแอดมิน");
      }
    }
  }
});

client.login(token);