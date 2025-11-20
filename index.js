const { Client, GatewayIntentBits, Events, Partials, EmbedBuilder, AttachmentBuilder,ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
require('dotenv').config();
const token = process.env.DISCORD_TOKEN;
const prefix = "!";
const targetUserId = [];
const mongoose = require('mongoose');

const commonQuestions = [
  { key: 'Name_Surname', question: "ไหนขอ ชื่อ-นามสกุล เราหน่อย \n[ตัวอย่างคำตอบ: นาย แฮมเต้อ หล่อดี]" },
  { key: 'Nickname', question: "เอ้ย ลืมถามชื่อเล่นของชื่อเล่นหน่อย \n[ตัวอย่างคำตอบ: โฟกัส]" },
  { key: 'Phone', question: "เบอร์โทรศัพท์ที่น้องใช้สมัครผ่านหน้าเว็บคืออะไรอ่ะ" },
  { key: 'School', question: "เรียนอยู่โรงเรียนอะไรอ่ะเรา \n[ตัวอย่างคำตอบ: โรงเรียนสาธิต...]" },
  { key: 'Age', question: "เรียนอยู่ชั้นไหนอ่ะเรา \n[ตัวอย่างคำตอบ: ม.6]" },
  { key: 'Line', question: "ขอชื่อ Line หน่อยครับ \n[ตัวอย่างคำตอบ: focus_hamster]" }
];

const courseConfig = {
  "🎮": {
    roleId: '1433750324920713267',
    courseName: 'GAME',
    displayName: 'กิจกรรม อยากลองสร้างเกมได้ไหม?',
    sheetName: 'gugame2',
    specificQuestions: [
      { key: 'From', question: "รู้จักกิจกรรมนี้มาจากที่ไหนอ่ะ \n[ตัวอย่างคำตอบ: IG , Facebook , TikTok] " },
      { key: 'Why', question: "ทำไมถึงสมัครมาอ่ะ \n[ตัวอย่างคำตอบ: คอนเทนต์ nuutordev โคตรสนุกเลยอยากมา]" },
      { key: 'Goal', question: "อยากเข้าคณะอะไร มหาลัยไหนครับ?" },
      { key: 'Project', question: "น้องอยากเข้าห้อง Unity หรือ Roblox ครับ?" },
    ]
  },
  "⭐": {
    roleId: '1388546120912998554',
    courseName: 'SIXTH',
    displayName: 'คอร์ส Starways',
    sheetName: 'Starways',
    specificQuestions: [
      { key: 'From', question: "รู้จักกิจกรรมนี้มาจากที่ไหนอ่ะ \n[ตัวอย่างคำตอบ: IG , Facebook , TikTok] " },
      { key: 'Why', question: "ทำไมถึงสมัครมาอ่ะ \n[ตัวอย่างคำตอบ: คอนเทนต์ nuutordev โคตรสนุกเลยอยากมา]" },
      { key: 'Goal', question: "อยากเข้าคณะอะไร มหาลัยไหนครับ?" },
      { key: 'Project', question: "น้องมีโปรเจคอะไรที่อยากทำเป็นพิเศษไหม? เช่น เกม AI เว็บ แอพ" },
    ]
  },
};

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

const MemberSchema = new mongoose.Schema(
  {
    id: String,
    fullname: String,
    nick: String,
    age: String,
    birthDate: Date, //
    mobile: String,
    line: String,
    lineName: String, //
    lineUserId: String, //
    email: String,
    coin: String,
    xp: String,
    code: String,
    discord_id: String,
    rank: String,
    interest: String, //
    experience: String, //
    goal: String, //
    course: String,
    courses: [
      {
        courseId: String,
        project: {
          name: String,
          url: String
        }
      }
    ],
    projects: [Number], //
    stats: [Number], //
    remark: String, //
    slogan: String, //
    youtube: String, //
    facebook: String, //
    github: String, //
    referer: String, //
    profileImage: String, //
    phc_status: Boolean,
    username: String,
    password: String,
    reports: [ //
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Report"
      }
    ],
    games: [ //
      {
        name: String,
        id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Game"
        }
      }
    ],
    data: Object,
    fyncid: String,
    currentScene: String,
    lastAuthentication: { type: Date, default: Date.now },
    stat: String, //
    finish: String,
    approve: String,
    items: Array,
    itemx: String,
    avatar: String,
    cworld: String,
    friendly: String,
    friends: Array,
    stage: String,
    stage2: String,
    stage3: String,
    stage4: String,
    stage5: String,
    times: Array,
    cstage: String,
    consultant: String,
    pro: String,
    con: String,
    unique: String,
    next: String,
    tempToken: String,
    google: String,
    ball: String,
    discordData: Object,
    prank: { type: String },
    eventIndex: { type: String },
    playertier: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    phcCoin: { type: String, default: 0 },
    joke_text: { type: String, default: "" },
    joke_url: { type: String, default: "" },
    contact: {
      ig: String,
      facebook: String,
      github: String,
      youtube: String
    },
    skill: {
      fogus: String,
      attitude: String,
      creativity: String,
      speed: String
    },
    about: {
      detail: String,
      clip: String
    },
    quota: String

  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

const Member = mongoose.model('Member', MemberSchema);

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

const selectionSessions = new Map();
const processingUsers = new Set();
const userSessionState = new Map();

async function generateUniqueId() {
  let isUnique = false;
  let newId = "";
  while (!isUnique) {
    newId = Math.floor(10000 + Math.random() * 90000).toString();
    const existing = await Member.findOne({ id: newId });
    if (!existing) {
      isUnique = true;
    }
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
    if (!existing) {
      isUnique = true;
    }
  }
  return newCode;
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

      const newId = await generateUniqueId();   // สุ่ม ID ตัวเลข 5 หลัก (จากโค้ดเดิม)
      const newCode = await generateUniqueCode(); // 🆕 สุ่ม Code ตัวอักษร 4 หลัก

      const newMember = new Member({
        // --- Identity ---
        id: newId,
        code: newCode,
        mobile: cleanPhone,
        discord_id: discordId,
        username: newCode,
        password: "1234554321",
        phc_status: true,

        // --- Personal Info ---
        fullname: extraData.fullname,
        nick: extraData.nick,
        line: extraData.line,
        age: extraData.age || "",
        email: "",

        // --- Game Stats ---
        coin: "0",
        xp: "0",
        rank: "Novice",

        // --- Course Info ---
        course: extraData.courseName || "",
        courses: [],

        // --- System Data (Fields ที่ไม่มี // ตาม Schema) ---
        data: {},
        discordData: {},
        items: [],
        friends: [],
        times: [],

        // --- General Strings (ตั้งค่าว่างไว้ก่อน) ---
        fyncid: "",
        currentScene: "",
        finish: "",
        approve: "",
        itemx: "",
        avatar: "",
        cworld: "",
        friendly: "",

        // --- Stages ---
        stage: "1",
        stage2: "",
        stage3: "",
        stage4: "",
        stage5: "",
        cstage: "",

        // --- Misc ---
        consultant: "",
        pro: "",
        con: "",
        unique: "",
        next: "",
        tempToken: "",
        google: "",
        ball: ""
      });

      await newMember.save();
      console.log(`✨ Created Success: ${newMember.fullname} (ID: ${newId}, Code: ${newCode})`);
      return newMember;
    }
  } catch (error) {
    console.error('MongoDB Error:', error);
    return null;
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function sendDataToWebApp(data, retryCount = 0) {
  const maxRetries = 5; // ลองใหม่ได้สูงสุด 5 ครั้ง

  try {
    const WEB_APP_URL = process.env.POST_APP_URL;
    if (!WEB_APP_URL) {
      console.error("WEB_APP_URL is not defined in .env file!");
      return null;
    }

    // ส่งข้อมูล
    const response = await axios.post(WEB_APP_URL, data);
    console.log('Successfully sent data to Web App:', response.data);
    return response.data.row;

  } catch (error) {
    if (error.response && (error.response.status === 429 || error.response.status >= 500)) {

      if (retryCount < maxRetries) {
        const waitTime = 2000 * (retryCount + 1);
        console.log(`⚠️ Google Sheets Busy (Error ${error.response.status})... รอ ${waitTime / 1000} วินาที และกำลังลองใหม่... (รอบที่ ${retryCount + 1}/${maxRetries})`);

        await sleep(waitTime); // หยุดรอ
        return sendDataToWebApp(data, retryCount + 1);
      } else {
        console.error('❌ Gave up retrying. Google Sheets is too busy.');
      }
    }

    console.error('Error sending data to Web App:', error.message);
    return null;
  }
}

async function askQuestion(channel, userId, questionText) {
  await channel.send(questionText);
  const filter = m => m.author.id === userId && m.channelId === channel.id;
  try {
    const collected = await channel.awaitMessages({ filter, max: 1, time: 300000, errors: ['time'] }); // รอ 5 นาที
    return collected.first().content;
  } catch (e) {
    return null;
  }
}

function createWelcomeEmbed(user, memberData) {
  const memberCode = memberData.code || 'ไม่มี';
  const memberCoin = memberData.coin || '0';

  return new EmbedBuilder()
    .setColor('#FFB13B')
    .setTitle(`🐹 ยินดีต้อนรับสู่ HamsterHub!`)
    .setDescription(`สวัสดีครับคุณ **${user.username}** 🎉\n\n` +
      `สมัครสมาชิคเรียบร้อยแล้ว !!\n` +
      `ขอให้สนุกกับการเรียนรู้และสร้างสรรค์ผลงานใน HamsterHub นะ!\n\n`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      {
        name: '💳 รหัสสมาชิก (Member Code)',
        value: `\`\`\`\n${memberCode}\n\`\`\``, // ใช้ \`\`\`\n ... \n\`\`\`
        inline: true
      },
      {
        name: '💰 เหรียญสะสม (Coins)',
        value: `\`\`\`\n${memberCoin} 🪙\n\`\`\``, // ใช้ \`\`\`\n ... \n\`\`\`
        inline: true
      },
      { name: '\u200B', value: '\u200B', inline: false }, // เว้นบรรทัดจริงๆ
      {
        name: '🎁 แลกของรางวัล',
        value: '👉 [hamsterhub.co/shop](https://hamsterhub.co/shop)',
        inline: false
      }
    )
    // (Optional) หากมี Banner ใส่ตรงนี้
    // .setImage('[https://media.discordapp.net/attachments/1162795991917400166/1162796092689739866/Hamster_Banner.png?ex=654a6686&is=6537f186&hm=](https://media.discordapp.net/attachments/1162795991917400166/1162796092689739866/Hamster_Banner.png?ex=654a6686&is=6537f186&hm=)...') 
    .setFooter({ text: 'HamsterHub - Community of Creators', iconURL: 'https://hamsterhub.co/favicon.ico' })
    .setTimestamp();
}

async function startInterview(user, courseData, guildId, sessionId) {
  const isSessionValid = () => userSessionState.get(user.id) === sessionId;
  if (!isSessionValid()) return;

  let linkedMemberData = null;

  try {
    const dmChannel = await user.createDM();
    const collectedData = { User_ID: user.id };

    await dmChannel.send(`👋 สวัสดีครับ! ก่อนเข้าห้อง **${courseData.displayName}** พี่ขอถามข้อมูลนิดนึงนะ`);

    for (const q of commonQuestions) {
      if (!isSessionValid()) return;
      const answer = await askQuestion(dmChannel, user.id, q.question);
      if (!answer) throw new Error("Timeout");
      collectedData[q.key] = answer;
    }

    for (const q of courseData.specificQuestions) {
      if (!isSessionValid()) return;
      const answer = await askQuestion(dmChannel, user.id, q.question);
      if (!answer) throw new Error("Timeout");
      collectedData[q.key] = answer;
    }

    if (collectedData.Phone) {
      await dmChannel.send("🔄 กำลังเชื่อมโยงข้อมูลกับระบบสมาชิก...");
      linkedMemberData = await updateDiscordIdToMongo(
        collectedData.Phone,
        user.id,
        {
          fullname: collectedData.Name_Surname,
          nick: collectedData.Nickname,
          line: collectedData.Line
        }
      );
    }

    if (!isSessionValid()) return;
    await dmChannel.send("📝 พี่กำลังบันทึกข้อมูลลงระบบ...");
    const finalData = { ...collectedData, SheetName: courseData.sheetName };
    const rowNumber = await sendDataToWebApp(finalData);

    if (!rowNumber) {
      await dmChannel.send("❌ เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      return;
    }

    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(user.id);
    const role = guild.roles.cache.get(courseData.roleId);

    if (role) {
      await member.roles.add(role);
      const finalNumber = rowNumber - 1;
      const newNickname = `${courseData.courseName}-${String(finalNumber).padStart(2, '0')} ${collectedData.Nickname}`;
      try { await member.setNickname(newNickname); } catch (e) { }
    }


    if (linkedMemberData) {
      const welcomeEmbed = createWelcomeEmbed(user, linkedMemberData);
      await dmChannel.send({ embeds: [welcomeEmbed] });
    } else {

      const simpleEmbed = new EmbedBuilder()
        .setColor('#00AAFF')
        .setTitle(`ยินดีต้อนรับ ${user.username}!`)
        .setDescription(`บันทึกข้อมูลเรียบร้อยแล้ว!\nคุณได้รับยศ **${role ? role.name : 'Member'}** เรียบร้อย\n(ยังไม่พบข้อมูลสมาชิกเก่าในระบบ หากเคยสมัครค่ายอื่นมาแล้วลองแจ้งแอดมินนะครับ)`)
        .setThumbnail(user.displayAvatarURL());

      await dmChannel.send({ embeds: [simpleEmbed] });
    }

  } catch (error) {
    if (!isSessionValid()) return;
    console.error(error);
    if (error.message !== "Timeout") await user.send("❌ Error: " + error.message);
  }
}

client.on(Events.ClientReady, () => {
  console.log(`logged in as ${client.user.tag}`);
});


client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  if (command === "help") {
    await message.reply('สวัสดีครับ! นี่คือบอท NuutorDev คำสั่งที่มีให้ใช้:\n\n' +
      '1. `!checkin` - เริ่มกระบวนการลงทะเบียนสมาชิกใหม่\n' +
      '2. `!profile` - ดูข้อมูลโปรไฟล์สมาชิกของคุณ\n' +
      '3. `!shop` - ลิงก์ไปยังร้านค้า HamsterHub\n\n' +
      'หากมีคำถามเพิ่มเติม โปรดติดต่อแอดมินของเซิร์ฟเวอร์นะครับ!');
  }

  if (command === "shop") {
    
    const shopButton = new ButtonBuilder()
      .setLabel('🛒 ไปที่ร้านค้า HamsterHub') 
      .setURL('https://hamsterhub.co/shop')  
      .setStyle(ButtonStyle.Link);           

  
    const row = new ActionRowBuilder()
      .addComponents(shopButton);

    const embed = new EmbedBuilder()
      .setColor('#FFB13B')
      .setTitle('🎁 HamsterHub Shop')
      .setDescription('นำ Coins หรือ Balls ที่สะสมได้ มาแลกของรางวัลสุดพิเศษได้ที่นี่เลย!')
      .setThumbnail('https://cdn-icons-png.flaticon.com/512/3081/3081559.png');

    await message.reply({
      embeds: [embed],
      components: [row]
    });
  }

  if (command === "addcoin") {
    const channelId = "1403034361678528512";
 
    const roleIds = ["699989557063581827", "807189391927410728", "857990230472130561"];

    const hasPermission = roleIds.some(role => message.member.roles.cache.has(role));

    if (!hasPermission) {
        return message.reply("❌ น้องไม่มีสิทธิ์ใช้คำสั่งนี้!");
    }

    let targetId = args[0].replace(/[^0-9]/g, '');
    const amount = parseInt(args[1]);

    if (!targetId || isNaN(amount)) {
        return message.reply("❌ รูปแบบคำสั่งผิดพลาด! กรุณาใช้: `!addcoin {MemberID} {จำนวน}`");
    }

    const member = await Member.findOne({ discord_id: targetId });
    
    if (!member) {
        return message.reply("❌ ไม่พบข้อมูลสมาชิกของน้องในระบบ");
    }


    member.coin = (parseInt(member.coin) + amount).toString();
    
    await member.save();
    
    const logChannel = client.channels.cache.get(channelId);
    if (logChannel) {
        logChannel.send(`✅ เพิ่ม HamsterCoin ให้ น้อง${member.nick} จำนวน ${amount} เหรียญ โดย ${message.author.username}`);
    } else {
        console.log("หาห้อง log ไม่เจอ");
    }

    message.reply(`✅ เพิ่มเหรียญสำเร็จ!`);
}

  if (command === "ads") {
    let sendedUserID = [];
    const sheetName = args[0];
    const messageToSend = args.slice(1).join(' ');

    const imageAttachment = message.attachments.first();

    if (!sheetName || !messageToSend) {
      return message.reply('❌ รูปแบบคำสั่งผิดพลาด! กรุณาใช้: `!ads {ชื่อชีต} {ข้อความ}`');
    }
    if (!imageAttachment) {
      return message.reply('❌ กรุณาแนบไฟล์รูปภาพมาพร้อมกับคำสั่งด้วยครับ');
    }

    const initialReply = await message.reply(`กำลังดึงข้อมูลจากชีต \`${sheetName}\`...`);

    try {
      const webAppUrl = process.env.GET_APP_URL;
      const response = await axios.get(`${webAppUrl}?sheet=${sheetName}&mode=all_ids`);
      const result = response.data;

      if (typeof result !== 'object' || result === null || !result.status) {
        return initialReply.edit(`❌ ได้รับข้อมูลจาก Google Sheets ในรูปแบบที่ไม่คาดคิด กรุณาตรวจสอบ Console ของบอท`);
      }
      if (result.status === "error") {
        return initialReply.edit(`❌ เกิดข้อผิดพลาด: ${result.message}`);
      }
      if (result.status === "success_nodata") {
        return initialReply.edit(`🟡 ${result.message}`);
      }

      const targetUserIds = result.data;
      await initialReply.edit(`✅ ${result.message}. เริ่มทำการส่งข้อความพร้อมรูปภาพ...`);

      const imageUrl = imageAttachment.url;

      let successCount = 0;
      let failCount = 0;

      for (const userId of targetUserIds) {
        try {
          const user = await client.users.fetch(userId);
          if (!sendedUserID.includes(userId))
            await user.send({
              content: messageToSend,
              files: [imageUrl]
            });
          sendedUserID.push(userId);
          successCount++;
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (err) {
          failCount++;
          console.error(`ไม่สามารถส่งข้อความหา ID: ${userId} ได้`, err.message);
        }
      }
      await message.channel.send(`🚀 **สรุปผลการส่งข้อความ:**\n- สำเร็จ: ${successCount} คน\n- ล้มเหลว: ${failCount} คน`);

    } catch (error) {
      initialReply.edit('❌ เกิดข้อผิดพลาดในการเชื่อมต่อกับ Google Sheets!');
      console.error(error);
    }
  }

  if (message.content.startsWith(prefix + "checkin")) {
    try {
      const member = message.member;
      const dm = await member.createDM();

      let description = 'ยินดีต้อนรับสู่ HamsterHub นะ! น้องเลือกกิจกรรม หรือ คอร์สที่เข้ามาเรียนได้เลย\n\n';
      for (const emoji in courseConfig) {
        description += `### - กด ${emoji} สำหรับ **${courseConfig[emoji].displayName}**\n`;
      }

      const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🎯 เลือกเส้นทางของคุณ')
        .setDescription(description)
        .setFooter({ text: 'กด Emoji ด้านล่างเพื่อเริ่มเลย!' });

      const menuMessage = await dm.send({ embeds: [embed] });

      for (const emoji of Object.keys(courseConfig)) {
        await menuMessage.react(emoji);
      }

      selectionSessions.set(menuMessage.id, {
        guildId: message.guild.id,
        userId: member.id
      });

      await message.reply("📩 พี่ส่งข้อความไปทาง DM แล้ว เช็คหน่อยนะ!");

    } catch (err) {
      console.error(err);
      await message.reply("❌ ไม่สามารถส่ง DM ได้ โปรดเปิดรับข้อความจากคนแปลกหน้าก่อนครับ");
    }
  }

  if (command === "profile") {
    const loadingMsg = await message.reply("🔍 กำลังค้นหาข้อมูลสมาชิก...");

    try {
      const member = await Member.findOne({ discord_id: message.author.id });

      if (!member) {
        return loadingMsg.edit({
          content: null,
          embeds: [
            new EmbedBuilder()
              .setColor('#FF0000')
              .setTitle('❌ ไม่พบข้อมูลสมาชิก')
              .setDescription('กรุณาพิมพ์ `!checkin` เพื่อลงทะเบียนก่อนนะครับ')
          ]
        });
      }

      // เตรียมข้อมูล (Format ให้อ่านง่าย)
      const displayName = member.fullname || "-";
      const displayNick = member.nick || "-";
      const displayCode = member.code || "-";
      const displayRole = member.rank || "Novice";
      const displayCoin = member.coin || "0";
      const displayBall = member.ball || "0";
      const displayCourse = member.course || "-"; // แก้ไขตรงนี้: ถ้าไม่มีให้ขีดแดช


      const profileEmbed = new EmbedBuilder()
        .setColor('#FFB13B')

        .setTitle(`🐹 ข้อมูลสมาชิก: น้อง${displayNick}`)

        .setDescription(`## คุณ ${displayName}\n> **ID:** \`${displayCode}\` \n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)

        .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))

        .addFields(

          {
            name: '🔰 Rank',
            value: `\`\`\` ${displayRole} \`\`\``,
            inline: true
          },

          {
            name: '💰 HCoin',
            value: `\`\`\`${displayCoin} \`\`\``,
            inline: true
          },
          {
            name: '🔮 Balls',
            value: `\`\`\`${displayBall} \`\`\``,
            inline: true
          },
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
  if (reaction.partial) {
    try { await reaction.fetch(); } catch (error) { console.error('Error fetching reaction:', error); return; }
  }

  const messageId = reaction.message.id;
  const session = selectionSessions.get(messageId);

  if (session && session.userId === user.id) {
    const emoji = reaction.emoji.name;
    const courseData = courseConfig[emoji];

    if (courseData) {
      selectionSessions.delete(messageId);
      await startInterview(user, courseData, session.guildId);
    }
  }
});

client.login(token);