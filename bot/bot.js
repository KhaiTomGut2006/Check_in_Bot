const { Client, GatewayIntentBits, Events, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const Member = require('../models/Member');
const { configState, loadConfig } = require('../utils/configLoader');
const { generateUniqueId, generateUniqueCode, cleanUserData, sendDataToWebApp } = require('../utils/helpers');

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

const prefix = "!";
const selectionSessions = new Map();
const userSessionState = new Map();

// --- Internal Functions ---
async function askQuestion(channel, userId, questionText) {
  await channel.send(questionText);
  const filter = m => m.author.id === userId && m.channelId === channel.id;
  try {
    const collected = await channel.awaitMessages({ filter, max: 1, time: 300000, errors: ['time'] });
    return collected.first().content;
  } catch (e) { return null; }
}

async function updateDiscordIdToMongo(phoneNumber, discordId, extraData) {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length < 9) return null;
  
      let member = await Member.findOne({
        $or: [{ mobile: cleanPhone }, { mobile: phoneNumber }]
      });
  
      if (member) {
        member.discord_id = discordId;
        await member.save();
        console.log(`✅ Linked Existing User: ${member.fullname}`);
        return member;
      } else {
        console.log(`🆕 Creating New User for mobile: ${cleanPhone}`);
        const newId = await generateUniqueId();
        const newCode = await generateUniqueCode();
  
        const newMember = new Member({
          id: newId, code: newCode, mobile: cleanPhone, discord_id: discordId,
          username: newCode, password: "1234554321", phc_status: true,
          fullname: extraData.fullname, nick: extraData.nick, line: extraData.line,
          age: extraData.age || "", email: "", coin: "0", xp: "0", rank: "Novice",
          course: extraData.courseName || "", courses: [],
          data: {}, discordData: {}, items: [], friends: [], times: [],
          fyncid: "", currentScene: "", finish: "", approve: "", itemx: "",
          avatar: "", cworld: "", friendly: "", stage: "1", stage2: "", stage3: "",
          stage4: "", stage5: "", cstage: "", consultant: "", pro: "", con: "",
          unique: "", next: "", tempToken: "", google: "", ball: ""
        });
  
        await newMember.save();
        console.log(`✨ Created Success: ${newMember.fullname}`);
        return newMember;
      }
    } catch (error) {
      console.error('MongoDB Error:', error);
      return null;
    }
}

async function startInterview(user, courseData, guildId, sessionId) {
  const isSessionValid = () => userSessionState.get(user.id) === sessionId;
  if (!isSessionValid()) return;

  let linkedMemberData = null;
  try {
    const dmChannel = await user.createDM();
    const collectedData = { User_ID: user.id };

    await dmChannel.send(`👋 สวัสดีครับ! ก่อนเข้าห้อง **${courseData.displayName}** พี่ขอถามข้อมูลนิดนึงนะ`);
    await dmChannel.send(`## ไม่ต้องมี ครับ/ค่ะ นะ พิมพ์แค่ข้อมูลที่พี่ถามมาได้เลย`);
    
    // ใช้ configState จาก configLoader
    for (const q of configState.commonQuestions) {
      if (!isSessionValid()) return;
      const answer = await askQuestion(dmChannel, user.id, q.question);
      if (!answer) throw new Error("Timeout");
      collectedData[q.key] = cleanUserData(answer);
    }

    for (const q of courseData.specificQuestions) {
      if (!isSessionValid()) return;
      const answer = await askQuestion(dmChannel, user.id, q.question);
      if (!answer) throw new Error("Timeout");
      collectedData[q.key] = cleanUserData(answer);
    }

    if (collectedData.Phone) {
      await dmChannel.send("🔄 กำลังเชื่อมโยงข้อมูลกับระบบสมาชิก...");
      linkedMemberData = await updateDiscordIdToMongo(collectedData.Phone, user.id, {
          fullname: collectedData.Name_Surname, nick: collectedData.Nickname,
          line: collectedData.Line, age: collectedData.Age, courseName: courseData.courseName
      });
    }

    if (!isSessionValid()) return;
    await dmChannel.send("📝 พี่กำลังบันทึกข้อมูลลงระบบ...");
    const finalData = { ...collectedData, SheetName: courseData.sheetName };
    const rowNumber = await sendDataToWebApp(finalData);

    if (!rowNumber) { await dmChannel.send("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล"); return; }

    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(courseData.roleId);

    if (role) {
      await member.roles.add(role);
      const finalNumber = rowNumber - 1;
      const newNickname = `${courseData.courseName}-${String(finalNumber).padStart(2, '0')} ${collectedData.Nickname}`;
      try { await member.setNickname(newNickname); } catch (e) { }
    }

    const welcomeEmbed = new EmbedBuilder()
        .setColor(linkedMemberData ? '#FFB13B' : '#ffe600ff')
        .setTitle(`ยินดีต้อนรับสู่ HamsterHub!`)
        .setDescription(linkedMemberData 
            ? `สวัสดีครับคุณ **${user.username}** 🎉\nสมัครสมาชิคเรียบร้อยแล้ว !!\n`
            : `บันทึกข้อมูลเรียบร้อยแล้ว!\nคุณได้รับยศ **${role ? role.name : 'Member'}** เรียบร้อย`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));
    
    if (linkedMemberData) {
        welcomeEmbed.addFields(
            { name: '💳 รหัสสมาชิก', value: `\`\`\`\n${linkedMemberData.code}\n\`\`\``, inline: true },
            { name: '💰 Coins', value: `\`\`\`\n${linkedMemberData.coin} 🪙\n\`\`\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '🎁 แลกของรางวัล', value: '👉 [hamsterhub.co/shop](https://hamsterhub.co/shop)', inline: false }
        );
    }

    await dmChannel.send({ embeds: [welcomeEmbed] });

  } catch (error) {
    if (!isSessionValid()) return;
    if (error.message === "Timeout") await user.send("⌛ หมดเวลา (พิมพ์ `!checkin` เพื่อเริ่มใหม่)");
    else console.error("Interview Error:", error);
  }
}

// --- Events ---

client.on(Events.ClientReady, () => {
  console.log(`🤖 Bot Logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // 1. RELOAD
  if (command === "reload" && message.member.permissions.has("Administrator")) {
      await loadConfig();
      return message.reply("✅ **Configuration Reloaded from Database!**");
  }

  // 2. CHECKIN
  if (command === "checkin") {
    try {
      const member = message.member;
      const dm = await member.createDM();
      let description = 'ยินดีต้อนรับสู่ HamsterHub นะ! น้องเลือกกิจกรรม หรือ คอร์สที่เข้ามาเรียนได้เลย\n\n';
      for (const emoji in configState.courseConfig) {
        description += `### - กด ${emoji} สำหรับ **${configState.courseConfig[emoji].displayName}**\n`;
      }
      const embed = new EmbedBuilder().setColor('#0099ff').setTitle('🎯 เลือกเส้นทางของคุณ').setDescription(description).setFooter({ text: 'กด Emoji ด้านล่างเพื่อเริ่มเลย!' });
      const menuMessage = await dm.send({ embeds: [embed] });
      for (const emoji of Object.keys(configState.courseConfig)) await menuMessage.react(emoji);
      selectionSessions.set(menuMessage.id, { guildId: message.guild.id, userId: member.id });
      await message.reply("📩 พี่ส่งข้อความไปทาง DM แล้ว เช็คหน่อยนะ!");
    } catch (err) {
      console.error(err);
      await message.reply("❌ ไม่สามารถส่ง DM ได้ โปรดเปิดรับข้อความจากคนแปลกหน้าก่อนครับ");
    }
  }

  // 3. HELP
  if (command === "help") {
    await message.reply('สวัสดีครับ! นี่คือบอท NuutorDev คำสั่งที่มีให้ใช้:\n\n' +
      '1. `!checkin` - เริ่มกระบวนการลงทะเบียนสมาชิกใหม่\n' +
      '2. `!profile` - ดูข้อมูลโปรไฟล์สมาชิกของคุณ\n' +
      '3. `!shop` - ลิงก์ไปยังร้านค้า HamsterHub\n\n' +
      'หากมีคำถามเพิ่มเติม โปรดติดต่อแอดมินของเซิร์ฟเวอร์นะครับ!');
  }

  // 4. SHOP
  if (command === "shop") {
    const shopButton = new ButtonBuilder().setLabel('🛒 ไปที่ร้านค้า HamsterHub').setURL('https://hamsterhub.co/shop').setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder().addComponents(shopButton);
    const embed = new EmbedBuilder()
      .setColor('#FFB13B')
      .setTitle('🎁 HamsterHub Shop')
      .setDescription('นำ Coins หรือ Balls ที่สะสมได้ มาแลกของรางวัลสุดพิเศษได้ที่นี่เลย!')
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3081/3081559.png');
    await message.reply({ embeds: [embed], components: [row] });
  }

  // 5. ADDCOIN
  if (command === "addcoin") {
    const channelId = "1403034361678528512";
    const roleIds = ["699989557063581827", "807189391927410728", "857990230472130561"]; // ใส่ Role ID ของ Admin หรือ Staff
    const hasPermission = roleIds.some(role => message.member.roles.cache.has(role));
    
    if (!hasPermission) return message.reply("❌ น้องไม่มีสิทธิ์ใช้คำสั่งนี้!");
    if (!args[0] || !args[1]) return message.reply("❌ รูปแบบคำสั่งผิดพลาด! กรุณาใช้: `!addcoin {MemberID} {จำนวน}`");

    let targetId = args[0].replace(/[^0-9]/g, '');
    const amount = parseInt(args[1]);

    if (!targetId || isNaN(amount)) return message.reply("❌ ID หรือ จำนวนเงินไม่ถูกต้อง");

    const member = await Member.findOne({ discord_id: targetId });
    if (!member) return message.reply("❌ ไม่พบข้อมูลสมาชิกของน้องในระบบ");

    member.coin = (parseInt(member.coin) + amount).toString();
    await member.save();

    const logChannel = client.channels.cache.get(channelId);
    if (logChannel) logChannel.send(`✅ เพิ่ม HamsterCoin ให้ น้อง${member.nick} จำนวน ${amount} เหรียญ โดย ${message.author.username}`);
    message.reply(`✅ เพิ่มเหรียญสำเร็จ!`);
  }

  // 6. PROFILE
  if (command === "profile") {
    const loadingMsg = await message.reply("🔍 กำลังค้นหาข้อมูลสมาชิก...");
    try {
      const member = await Member.findOne({ discord_id: message.author.id });
      if (!member) {
        return loadingMsg.edit({
          content: null,
          embeds: [new EmbedBuilder().setColor('#FF0000').setTitle('❌ ไม่พบข้อมูลสมาชิก').setDescription('กรุณาพิมพ์ `!checkin` เพื่อลงทะเบียนก่อนนะครับ')]
        });
      }
      const displayName = member.fullname || "-";
      const displayNick = member.nick || "-";
      const displayCode = member.code || "-";
      const displayRole = member.rank || "Novice";
      const displayCoin = member.coin || "0";
      const displayBall = member.ball || "0";

      const profileEmbed = new EmbedBuilder()
        .setColor('#FFB13B')
        .setTitle(`🐹 ข้อมูลสมาชิก: น้อง${displayNick}`)
        .setDescription(`## คุณ ${displayName}\n> **ID:** \`${displayCode}\` \n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '🔰 Rank', value: `\`\`\` ${displayRole} \`\`\``, inline: true },
          { name: '💰 HCoin', value: `\`\`\`${displayCoin} \`\`\``, inline: true },
          { name: '🔮 Balls', value: `\`\`\`${displayBall} \`\`\``, inline: true },
        )
        .setFooter({ text: 'HamsterHub Member System', iconURL: 'https://hamsterhub.co/favicon.ico' })
        .setTimestamp();

      await loadingMsg.edit({ content: null, embeds: [profileEmbed] });
    } catch (error) {
      console.error("Profile Error:", error);
      await loadingMsg.edit("❌ เกิดข้อผิดพลาดในการดึงข้อมูล");
    }
  }

});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) try { await reaction.fetch(); } catch (e) { return; }

  const messageId = reaction.message.id;
  const session = selectionSessions.get(messageId);
  if (session && session.userId === user.id) {
    const emoji = reaction.emoji.name;
    const courseData = configState.courseConfig[emoji];
    if (courseData) {
      selectionSessions.delete(messageId);
      await startInterview(user, courseData, session.guildId);
    }
  }
});

module.exports = { client };