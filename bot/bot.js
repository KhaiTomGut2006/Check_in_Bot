// ==========================================
// 1. IMPORTS & SETUP
// ==========================================
const { 
    Client, GatewayIntentBits, Events, Partials, EmbedBuilder, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits,
    REST, Routes, SlashCommandBuilder
} = require('discord.js');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource, 
    AudioPlayerStatus, getVoiceConnection 
} = require('@discordjs/voice');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');

// Models & Utils
const Member = require('../models/Member');
const { User: GameUser } = require('../models/GameUser');
const { configState, loadConfig } = require('../utils/configLoader');
const { generateUniqueId, generateUniqueCode, cleanUserData, sendDataToWebApp } = require('../utils/helpers');

// Initialize Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction]
});

// ==========================================
// 2. CONFIGURATION & CONSTANTS
// ==========================================
const API_GAME = process.env.GAME_API || "http://localhost:5000/api/v1/bot";
const WEB_BASE_URL = "https://api.questcity.cloud/hamster-quest";
const BOT_SECRET = process.env.BOT_SECRET;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const TOKEN = process.env.DISCORD_TOKEN;

// ⚠️ ใส่ ID เซิฟเวอร์ที่นี่เพื่อให้คำสั่ง / ขึ้นทันที
const GUILD_ID = "699984143542517801"; 

// IDs
const LEADERBOARD_CHANNEL_ID = "1447874576582443048";
const JAIL_CHANNEL_ID = "1442075926509785108";
const PROTECTED_USER_ID = "563644358352568331";
const LOG_CHANNEL_ID = "1403034361678528512";
const STAFF_ROLES = ["699989557063581827", "807189391927410728", "857990230472130561"];

const LEADERBOARD_PER_PAGE = 10;
const RARITY_COLORS = { 'Common': '#B0C4DE', 'Rare': '#1E90FF', 'Epic': '#9370DB', 'Legendary': '#FFD700' };
const RARITY_DISPLAY = {
    'Common': { emoji: '⚪', text: '**COMMON**' },
    'Rare': { emoji: '🔵', text: '**RARE**' },
    'Epic': { emoji: '🟣', text: '**EPIC**' },
    'Legendary': { emoji: '🌟', text: '**LEGENDARY**' }
};
const RANK_ROLE_MAP = {
    'Meteor I': '1438920448816578673',
    'Meteor II': '1438920975851720744',
    'Meteor III': '1438921540363358362',
    'Planet I': '1439120384178917426'
};

const RANK_PRIORITY = {
    'Planet I': 4,
    'Meteor III': 3,
    'Meteor II': 2,
    'Meteor I': 1,
    'Novice': 0,
    'Unranked': 0
};

// กำหนดสีหรือไอคอนประจำยศให้ดูง่าย
const RANK_STYLES = {
    'Planet I':  { icon: '🪐', name: 'PLANET I' },
    'Meteor III': { icon: '☄️', name: 'Meteor III' },
    'Meteor II':  { icon: '🌑', name: 'Meteor II' },
    'Meteor I':   { icon: '🌑', name: 'Meteor I' },
    'Novice':    { icon: '🌱', name: 'Novice' }
};
const ALL_RANK_ROLE_IDS = Object.values(RANK_ROLE_MAP);

// ==========================================
// 3. GLOBAL STATE
// ==========================================
let leaderboardMessageId = null;
let isLeaderboardUpdating = false;
let leaderboardUpdateTimeout = null;
const selectionSessions = new Map();
const jailedUsers = new Map();

// ==========================================
// 4. SLASH COMMAND REGISTRATION
// ==========================================
const slashCommands = [
    new SlashCommandBuilder().setName('checkin').setDescription('ลงทะเบียนสมาชิกใหม่ / เลือกสายการเรียน'),
    new SlashCommandBuilder().setName('profile').setDescription('ดูข้อมูลโปรไฟล์ สถิติ และเงิน'),
    new SlashCommandBuilder().setName('shop').setDescription('เปิดร้านค้าประจำวัน'),
];

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        console.log('Started refreshing application (/) commands.');
        if (GUILD_ID) {
            await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: slashCommands });
            console.log('✅ Registered Guild Commands (Instant)');
        } else {
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: slashCommands });
            console.log('⚠️ Registered Global Commands (Might take 1 hour)');
        }
    } catch (error) {
        console.error(error);
    }
}

// ==========================================
// 5. AUDIO & JAIL SYSTEM
// ==========================================
const JAIL_SOUND_PATH = path.join(__dirname, 'jail.mp3');
const jailPlayer = createAudioPlayer();

jailPlayer.on(AudioPlayerStatus.Idle, () => {
    if (jailedUsers.size > 0) {
        const resource = createAudioResource(JAIL_SOUND_PATH);
        jailPlayer.play(resource);
    }
});

function manageJailVoice(guild) {
    const connection = getVoiceConnection(guild.id);
    if (jailedUsers.size > 0) {
        if (!connection) {
            const newConnection = joinVoiceChannel({
                channelId: JAIL_CHANNEL_ID,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });
            newConnection.subscribe(jailPlayer);
        }
        if (jailPlayer.state.status === AudioPlayerStatus.Idle) {
            const resource = createAudioResource(JAIL_SOUND_PATH);
            jailPlayer.play(resource);
        }
    } else {
        jailPlayer.stop();
        if (connection) connection.destroy();
    }
}

function unjailUser(member) {
    if (jailedUsers.has(member.id)) {
        const userData = jailedUsers.get(member.id);
        if (userData.timer) clearTimeout(userData.timer);
        jailedUsers.delete(member.id);
        manageJailVoice(member.guild);
    }
}

// ==========================================
// 6. HELPER FUNCTIONS
// ==========================================
async function generateLeaderboardPayload(page = 1) {
    try {
        // 1. ดึงข้อมูล
        const allUsers = await GameUser.find({ leaderboardScore: { $gt: 0 } })
            .select('nick rank leaderboardScore avatar discordId username');

        // 2. Sort: Rank มาก่อน -> Score ไว้ตัดสินถ้ายศเท่ากัน
        allUsers.sort((a, b) => {
            const tierA = a.rank?.currentTier || 'Novice';
            const tierB = b.rank?.currentTier || 'Novice';
            const weightA = RANK_PRIORITY[tierA] || 0;
            const weightB = RANK_PRIORITY[tierB] || 0;

            if (weightA !== weightB) return weightB - weightA; 
            return b.leaderboardScore - a.leaderboardScore;
        });

        // 3. Pagination
        const totalUsers = allUsers.length;
        const totalPages = Math.ceil(totalUsers / LEADERBOARD_PER_PAGE) || 1;
        page = Math.max(1, Math.min(page, totalPages));

        const startIndex = (page - 1) * LEADERBOARD_PER_PAGE;
        const usersOnPage = allUsers.slice(startIndex, startIndex + LEADERBOARD_PER_PAGE);

        const embed = new EmbedBuilder()
            .setColor('#2F3136') 
            .setTitle(`🏆 **HALL OF FAME**`)
            .setDescription(`*Real-time Ranking (Class Priority)*`)
            .setFooter({ text: `Page ${page} / ${totalPages} • Players: ${totalUsers}` });

        let thumbnailImage = 'https://cdn-icons-png.flaticon.com/512/3153/3153105.png';
        
        let description = "";
        if (usersOnPage.length === 0) {
            description = "waiting for players...";
        } else {
            if (usersOnPage[0].avatar) thumbnailImage = usersOnPage[0].avatar;

            for (let i = 0; i < usersOnPage.length; i++) {
                const user = usersOnPage[i];
                const globalRank = startIndex + i + 1;
                const displayName = user.nick || user.username || "Anonymous";
                const tierRaw = user.rank?.currentTier || "Novice";
                const rankStyle = RANK_STYLES[tierRaw] || { icon: '🛡️', name: tierRaw };

                // --- 👑 อันดับ 1 ---
                if (globalRank === 1) {
                    description += `# 👑 1. ${displayName}\n`; 
                    description += `### ${rankStyle.icon} ${rankStyle.name}\n`; // โชว์แค่ยศ
                    description += `━━━━━━━━━━━━━━━━━━\n`;
                } 
                // --- 🥈🥉 อันดับ 2-3 ---
                else if (globalRank <= 3) {
                    const medal = globalRank === 2 ? '🥈' : '🥉';
                    description += `## ${medal} ${globalRank}. ${displayName}\n`;
                    description += `**${rankStyle.icon} ${rankStyle.name}**\n\n`; // เว้นบรรทัดนิดหน่อย
                } 
                // --- 🎖️ อันดับ 4 ขึ้นไป (ปรับระยะห่าง) ---
                else {
                    // รูปแบบ: #4  Icon RankName — ชื่อคน
                    description += `**#${globalRank}** ${rankStyle.icon} **${rankStyle.name}** — ${displayName}\n`;
                    description += `\n`; // <--- เพิ่มบรรทัดว่างตรงนี้เพื่อให้ห่างกันมากขึ้น
                }
            }
        }

        embed.setDescription(description);
        embed.setThumbnail(thumbnailImage);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`lb_prev_${page}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(page === 1),
            new ButtonBuilder().setCustomId(`lb_refresh_${page}`).setLabel('⟳').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`lb_next_${page}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages)
        );

        return { embeds: [embed], components: [row] };

    } catch (error) {
        console.error("Generate Leaderboard Error:", error);
        return null;
    }
}

async function updateLeaderboardUI(guild, forcePage = 1) {
    if (isLeaderboardUpdating) return;
    isLeaderboardUpdating = true;
    if (leaderboardUpdateTimeout) clearTimeout(leaderboardUpdateTimeout);

    leaderboardUpdateTimeout = setTimeout(async () => {
        try {
            const channel = guild.channels.cache.get(LEADERBOARD_CHANNEL_ID);
            if (!channel) { isLeaderboardUpdating = false; return; }

            const payload = await generateLeaderboardPayload(forcePage);
            if (!payload) { isLeaderboardUpdating = false; return; }

            if (!leaderboardMessageId) {
                const messages = await channel.messages.fetch({ limit: 5 });
                const lastBotMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0 && m.embeds[0].title.includes("LEADERBOARD"));
                if (lastBotMsg) leaderboardMessageId = lastBotMsg.id;
            }

            if (leaderboardMessageId) {
                try {
                    const msg = await channel.messages.fetch(leaderboardMessageId);
                    await msg.edit(payload);
                } catch (e) {
                    const newMsg = await channel.send(payload);
                    leaderboardMessageId = newMsg.id;
                }
            } else {
                const newMsg = await channel.send(payload);
                leaderboardMessageId = newMsg.id;
            }
        } catch (err) {
            console.error("Update Leaderboard UI Error:", err);
        } finally {
            isLeaderboardUpdating = false;
        }
    }, 5000);
}

async function renderShop(targetUserId) {
    try {
        // ดึงข้อมูลจาก API และ Database
        const response = await axios.get(`${API_GAME}/shop/${targetUserId}`, { headers: { 'x-bot-secret': BOT_SECRET } });
        const gameUser = await GameUser.findOne({ discordId: targetUserId });
        const shopData = response.data || {}; // กัน shopData เป็น null

        // ⚠️ จุดที่แก้: ใส่ || 0 เพื่อกัน error ถ้าไม่มี coins
        const currentCoins = shopData.coins || 0; 
        const userNick = gameUser ? gameUser.nick : "Unknown";

        const headerEmbed = new EmbedBuilder()
            .setTitle(`✨🛒 HamsterHub: ร้านค้าประจำวัน 🛒✨`)
            .setDescription(`## 👤 **ลูกค้า:** ${userNick}\n\n## 💰 \`${currentCoins.toLocaleString()}\` 🪙\n> 🕒 *ร้านค้าจะรีเซ็ตสินค้าใหม่ทุกๆ เที่ยงคืน*`)
            .setColor('#2E8B57')
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/3081/3081559.png');

        const embedsToSend = [headerEmbed];
        const row = new ActionRowBuilder();
        const slotEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

        if (shopData.items && shopData.items.length > 0) {
            shopData.items.forEach((item, index) => {
                const rarityColor = RARITY_COLORS[item.rarity] || '#808080';
                const rarityInfo = RARITY_DISPLAY[item.rarity] || { emoji: '💎', text: item.rarity };
                const slotEmoji = slotEmojis[index] || `[${item.slot}]`;
                const stockDisplay = item.stock <= 3 && item.stock > 0 ? `🔥 **เหลือเพียง \`${item.stock}\` ชิ้นสุดท้าย!**` : `📦 **คงเหลือ:** \`${item.stock}\` ชิ้น`;

                const itemEmbed = new EmbedBuilder()
                    .setTitle(`${slotEmoji}  **${item.name}**`)
                    .setColor(rarityColor)
                    .addFields(
                        { name: 'รายละเอียดสินค้า', value: `${rarityInfo.emoji} ${rarityInfo.text}\n💰 **ราคา:** \`${(item.price || 0).toLocaleString()}\` coins`, inline: true },
                        { name: 'สถานะคลัง', value: stockDisplay, inline: true }
                    );

                if (item.icon) {
                    let iconUrl = item.icon.startsWith('http') ? item.icon : `${WEB_BASE_URL}${item.icon}`;
                    itemEmbed.setThumbnail(iconUrl);
                }
                embedsToSend.push(itemEmbed);

                const canBuy = item.stock > 0 && currentCoins >= item.price;
                const isOutOfStock = item.stock <= 0;
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop_buy_${item.slot}`)
                        .setLabel(isOutOfStock ? `❌ Slot ${item.slot} (ของหมด)` : `🛒 ซื้อ ${item.name} (${item.price})`)
                        .setStyle(isOutOfStock ? ButtonStyle.Secondary : ButtonStyle.Success)
                        .setDisabled(!canBuy)
                );
            });
        } else {
            embedsToSend.push(new EmbedBuilder().setDescription("# ❌ ไม่พบรายการสินค้าในขณะนี้").setColor('#FF0000'));
        }

        return { embeds: embedsToSend, components: row.components.length > 0 ? [row] : [] };

    } catch (error) {
        console.error("Render Shop Error:", error);
        throw error;
    }
}

async function syncSingleUser(guild, userDb) {
    try {
        if (!userDb.discordId || !userDb.rank) return;
        const member = await guild.members.fetch(userDb.discordId).catch(() => null);
        if (!member) return;

        const currentTier = userDb.rank.currentTier;
        const targetRoleId = RANK_ROLE_MAP[currentTier];
        if (!targetRoleId) return;

        const rolesToAdd = [];
        const rolesToRemove = [];
        if (!member.roles.cache.has(targetRoleId)) rolesToAdd.push(targetRoleId);
        for (const roleId of ALL_RANK_ROLE_IDS) {
            if (roleId !== targetRoleId && member.roles.cache.has(roleId)) rolesToRemove.push(roleId);
        }
        if (rolesToAdd.length > 0 || rolesToRemove.length > 0) {
            if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove);
            if (rolesToAdd.length > 0) await member.roles.add(rolesToAdd);
        }
    } catch (error) {
        console.error(`Sync Error for ${userDb.discordId}:`, error.message);
    }
}

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

        let member = await Member.findOne({ $or: [{ mobile: cleanPhone }, { mobile: phoneNumber }] });
        let savedMember;
        if (member) {
            member.discord_id = discordId;
            savedMember = await member.save();
        } else {
            const newId = await generateUniqueId();
            const newCode = await generateUniqueCode();
            const newMember = new Member({
                id: newId, code: newCode, mobile: cleanPhone, discord_id: discordId,
                username: newCode, password: "1234554321", phc_status: true,
                fullname: extraData.fullname, nick: extraData.nick, line: extraData.line,
                age: extraData.age || "", coin: "0", xp: "0", rank: "Novice",
                course: extraData.courseName || "", courses: [], data: {}, items: []
            });
            savedMember = await newMember.save();
        }
        try {
            await axios.post(`${API_GAME}/users`, {
                discordId: discordId, code: savedMember.code, mobile: cleanPhone,
                fullname: extraData.fullname, nick: extraData.nick, line: extraData.line, age: extraData.age
            }, { headers: { 'x-bot-secret': BOT_SECRET } });
        } catch (apiError) { console.error(`FAILED to sync GameUser via API: ${apiError.message}`); }
        return savedMember;
    } catch (error) {
        console.error("Error in updateDiscordIdToMongo:", error);
        return null;
    }
}

async function startInterview(user, courseData, guildId) {
    let linkedMemberData = null;
    try {
        const dmChannel = await user.createDM();
        const collectedData = { User_ID: user.id };
        await dmChannel.send(`👋 สวัสดีครับ! ก่อนเข้าห้อง **${courseData.displayName}** พี่ขอถามข้อมูลนิดนึงนะ\n## ไม่ต้องมี ครับ/ค่ะ นะ พิมพ์แค่ข้อมูลที่พี่ถามมาได้เลย`);

        for (const q of configState.commonQuestions) {
            const answer = await askQuestion(dmChannel, user.id, q.question);
            if (!answer) throw new Error("Timeout");
            collectedData[q.key] = cleanUserData(answer);
        }
        for (const q of courseData.specificQuestions) {
            const answer = await askQuestion(dmChannel, user.id, q.question);
            if (!answer) throw new Error("Timeout");
            collectedData[q.key] = cleanUserData(answer);
        }

        if (collectedData.Phone) {
            await dmChannel.send("🔄 กำลังเชื่อมโยงข้อมูลกับระบบสมาชิก...");
            const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: false });
            linkedMemberData = await updateDiscordIdToMongo(collectedData.Phone, user.id, {
                fullname: collectedData.Name_Surname, nick: collectedData.Nickname,
                line: collectedData.Line, age: collectedData.Age, courseName: courseData.courseName, username: user.username, avatar: avatarUrl
            });
        }
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
            .setColor(linkedMemberData ? '#FFB13B' : '#FFE600')
            .setTitle(`ยินดีต้อนรับสู่ HamsterHub!`)
            .setDescription(linkedMemberData ? `สวัสดีครับคุณ **${user.username}** 🎉\nสมัครสมาชิคเรียบร้อยแล้ว !!` : `บันทึกข้อมูลเรียบร้อยแล้ว!\nคุณได้รับยศ **${role ? role.name : 'Member'}** เรียบร้อย`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }));

        if (linkedMemberData) {
            welcomeEmbed.addFields(
                { name: '💳 รหัสสมาชิก', value: `\`\`\`\n${linkedMemberData.code}\n\`\`\``, inline: true },
                { name: '💰 Coins', value: `\`\`\`\n${linkedMemberData.coin} 🪙\n\`\`\``, inline: true },
                { name: '🎁 แลกของรางวัล', value: '👉 [hamsterhub.co/shop](https://hamsterhub.co/shop)', inline: false }
            );
        }
        await dmChannel.send({ embeds: [welcomeEmbed] });

    } catch (error) {
        if (error.message === "Timeout") await user.send("⌛ หมดเวลา (พิมพ์ `/checkin` เพื่อเริ่มใหม่)");
        else console.error("Interview Error:", error);
    }
}

// ==========================================
// 7. EVENT HANDLERS
// ==========================================

client.on(Events.ClientReady, async () => {
    console.log(`🤖 Bot Logged in as ${client.user.tag}`);
    await loadConfig();
    await registerCommands();
    console.log("👀 Initializing Database Watcher...");

    try {
        const changeStream = GameUser.watch([], { fullDocument: 'updateLookup' });
        changeStream.on('change', async (change) => {
            if (change.operationType === 'insert' || change.operationType === 'update') {
                const userDb = change.fullDocument;
                let shouldUpdateRank = false;
                let shouldUpdateLeaderboard = false;

                if (change.operationType === 'insert') {
                    shouldUpdateRank = true;
                    shouldUpdateLeaderboard = true;
                } else if (change.operationType === 'update') {
                    const updatedFields = change.updateDescription.updatedFields || {};
                    const keys = Object.keys(updatedFields);
                    if (keys.some(k => k.includes('rank') || k.includes('discordId'))) shouldUpdateRank = true;
                    if (keys.some(k => k.includes('leaderboardScore') || k.includes('nick'))) shouldUpdateLeaderboard = true;
                }

                if (shouldUpdateRank && userDb && userDb.discordId) {
                    for (const [guildId, guild] of client.guilds.cache) await syncSingleUser(guild, userDb);
                }
                if (shouldUpdateLeaderboard) {
                    for (const [guildId, guild] of client.guilds.cache) {
                        if (guild.channels.cache.has(LEADERBOARD_CHANNEL_ID)) await updateLeaderboardUI(guild, 1);
                    }
                }
            }
        });
        console.log("✅ Database Watcher is Active!");
    } catch (err) {
        console.error("⚠️ Watcher Failed:", err.message);
    }
});

// --- HANDLE SLASH COMMANDS (User) ---
client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'checkin') {
            await interaction.deferReply({ flags: 64 });
            try {
                const dm = await interaction.user.createDM();
                let description = 'ยินดีต้อนรับสู่ HamsterHub นะ! น้องเลือกกิจกรรม หรือ คอร์สที่เข้ามาเรียนได้เลย\n\n';
                for (const emoji in configState.courseConfig) {
                    description += `### - กด ${emoji} สำหรับ **${configState.courseConfig[emoji].displayName}**\n`;
                }
                const embed = new EmbedBuilder().setColor('#0099ff').setTitle('🎯 เลือกเส้นทางของคุณ').setDescription(description).setFooter({ text: 'กด Emoji ด้านล่างเพื่อเริ่มเลย!' });
                const menuMessage = await dm.send({ embeds: [embed] });
                for (const emoji of Object.keys(configState.courseConfig)) await menuMessage.react(emoji);
                selectionSessions.set(menuMessage.id, { guildId: interaction.guildId, userId: interaction.user.id });
                await interaction.editReply("📩 พี่ส่งข้อความไปทาง DM แล้วครับ เช็คหน่อยนะ!");
            } catch (err) {
                console.error(err);
                await interaction.editReply("❌ ส่ง DM ไม่ได้ครับ รบกวนเปิดรับข้อความจากคนแปลกหน้า (Direct Messages) ก่อนนะครับ");
            }
        }

        if (commandName === 'profile') {
            await interaction.deferReply({ flags: 64 });
            try {
                const gameUser = await GameUser.findOne({ discordId: interaction.user.id });
                if (!gameUser) return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#FF0000').setTitle('❌ ไม่พบข้อมูลสมาชิก').setDescription('กรุณาพิมพ์ `/checkin` เพื่อลงทะเบียนก่อนนะครับ')] });

                const profileEmbed = new EmbedBuilder()
                    .setColor('#FFB13B')
                    .setTitle(`🐹 ข้อมูลสมาชิก: น้อง${gameUser.nick || "-"}`)
                    .setDescription(`## ${gameUser.fullname || "ไม่ระบุ"}\n> **ID:** \`${gameUser.code || "-"}\` \n▬▬▬▬▬▬▬▬▬▬▬▬▬▬`)
                    .setThumbnail(gameUser.avatar || interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                    .addFields(
                        { name: '🔰 Rank', value: `\`\`\` ${gameUser.rank?.currentTier || "Unranked"} \`\`\``, inline: true },
                        { name: '🏆 Score', value: `\`\`\` ${(gameUser.leaderboardScore || 0).toLocaleString()} \`\`\``, inline: true },
                        { name: '💰 Coins', value: `\`\`\` ${(gameUser.coins || 0).toLocaleString()} \`\`\``, inline: true },
                    )
                    .setFooter({ text: 'HamsterHub Member System' }).setTimestamp();
                await interaction.editReply({ embeds: [profileEmbed] });
            } catch (error) {
                console.error("Profile Error:", error);
                await interaction.editReply("❌ เกิดข้อผิดพลาดในการดึงข้อมูล");
            }
        }

        if (commandName === 'shop') {
            await interaction.deferReply({ flags: 64 });
            try {
                const shopRenderData = await renderShop(interaction.user.id);
                await interaction.editReply(shopRenderData);
            } catch (err) {
                const errMsg = err.response?.data?.message || "เชื่อมต่อกับร้านค้าไม่ได้";
                await interaction.editReply(`❌ เกิดข้อผิดพลาด: ${errMsg}`);
            }
        }
    }

    // --- HANDLE BUTTONS ---
    if (interaction.isButton()) {
        const customId = interaction.customId;

        if (customId.startsWith('shop_buy_')) {
            const slot = customId.split('_')[2];
            await interaction.deferUpdate();
            try {
                const buyResponse = await axios.post(`${API_GAME}/shop/buy`, {
                    discordId: interaction.user.id,
                    slot: parseInt(slot)
                }, { headers: { 'x-bot-secret': BOT_SECRET } });

                if (buyResponse.data.success) {
                    const itemData = buyResponse.data.data;
                    await interaction.followUp({ content: `✅ ซื้อ **${itemData.itemName}** สำเร็จ! (เหลือเงิน: ${itemData.remainingCoins})`, flags: 64 });
                    const updatedShop = await renderShop(interaction.user.id);
                    await interaction.editReply(updatedShop);
                }
            } catch (err) {
                const apiMsg = err.response?.data?.message || "การสั่งซื้อล้มเหลว";
                await interaction.followUp({ content: `❌ ซื้อไม่ได้: ${apiMsg}`, flags: 64 });
            }
        }

        if (customId.startsWith('lb_')) {
            const parts = customId.split('_');
            const action = parts[1];
            let currentPage = parseInt(parts[2]);

            if (action === 'prev') currentPage -= 1;
            if (action === 'next') currentPage += 1;

            await interaction.deferUpdate();
            const payload = await generateLeaderboardPayload(currentPage);
            if (payload) await interaction.editReply(payload);
        }
    }
});

// --- HANDLE PREFIX COMMANDS (Admin/Staff) ---
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const isStaff = STAFF_ROLES.some(role => message.member.roles.cache.has(role));

    if (command === 'help') {
        message.reply({
            content: `## 📜 คำสั่งสำหรับผู้เล่น (Slash Command /)\n` +
                     `- \`/checkin\` : ลงทะเบียน / เลือกกิจกรรม\n` +
                     `- \`/profile\` : ดูข้อมูลส่วนตัว (Rank, Coins)\n` +
                     `- \`/shop\` : ซื้อไอเทม\n\n` +
                     `## 🛡️ คำสั่งสำหรับ Staff (Prefix !)\n` +
                     `- \`!jail @user [นาที]\` : ขังลืม\n` +
                     `- \`!unjail @user\` : ปลดปล่อย\n` +
                     `- \`!addcoin [ID] [จำนวน]\` : เสกเงิน\n` +
                     `- \`!ads [SheetName] [ข้อความ]\` : ส่ง DM หาคนในชีท\n` +
                     `- \`!setup-leaderboard\` : สร้างป้ายจัดอันดับ (ในห้องเฉพาะ)`,
        });
    }

    else if (command === 'leaderboard') {
        if (!isStaff) return message.reply("❌ ไม่มีสิทธิ์ครับ");
        if (message.channelId !== LEADERBOARD_CHANNEL_ID) return message.reply(`❌ กรุณาใช้คำสั่งนี้ในห้อง <#${LEADERBOARD_CHANNEL_ID}> เท่านั้น`);
        message.reply("✅ เริ่มต้นระบบ Leaderboard...");
        await updateLeaderboardUI(message.guild, 1);
    }

    else if (command === 'jail') {
        let targetMember;
        let minutes = 1;
        let isKarma = false;
        let messageText = "";

        if (isStaff) {
            targetMember = message.mentions.members.first();
            if (args[1]) minutes = parseInt(args[1]) || 1;
            if (!targetMember) return message.reply("❌ กรุณาแท็กคนที่จะขัง");
        } else {
            targetMember = message.member;
            minutes = 1;
            isKarma = true;
            messageText += "🚫 ห้ามใช้ครับน้องชาย! (โดนขังเอง 1 นาที)\n";
        }

        if (targetMember.id === PROTECTED_USER_ID) {
            targetMember = message.member;
            minutes = 5;
            isKarma = true;
            messageText = "💢 บังอาจจะขังท่านผู้นั้นหรอ!? โดนเองไปซะ 5 นาที!!\n";
        }

        if (!targetMember.voice.channel) return message.reply(`${messageText}❌ เป้าหมายไม่ได้อยู่ในห้องเสียง จับขังไม่ได้ (รอดไปนะ)`);

        try {
            if (jailedUsers.has(targetMember.id)) {
                const existing = jailedUsers.get(targetMember.id);
                if (existing.timer) clearTimeout(existing.timer);
                jailedUsers.delete(targetMember.id);
            }

            const totalMilliseconds = minutes * 60 * 1000;
            await targetMember.voice.setChannel(JAIL_CHANNEL_ID);

            const timer = setTimeout(() => {
                unjailUser(targetMember);
                message.channel.send(`✅ ${targetMember.user.tag} พ้นโทษแล้ว (ครบเวลา)`);
            }, totalMilliseconds);

            jailedUsers.set(targetMember.id, { remainingTime: totalMilliseconds, timer: timer, startTime: Date.now() });
            manageJailVoice(message.guild);

            if (isKarma) await message.reply(`${messageText}`);
            else await message.reply(`✅ จับขัง ${targetMember.user.tag} เป็นเวลา ${minutes} นาที`);

        } catch (error) {
            console.error(error);
            await message.reply('❌ เกิดข้อผิดพลาด (บอทยศไม่ถึง หรือย้ายห้องไม่ได้)');
        }
    }

    else if (command === 'unjail') {
        if (!isStaff) return message.reply("❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้");
        const targetMember = message.mentions.members.first();
        if (targetMember && jailedUsers.has(targetMember.id)) {
            unjailUser(targetMember);
            await message.reply(`✅ ปลดปล่อย ${targetMember.user.tag} แล้ว!`);
        } else {
            await message.reply(`❌ ผู้ใช้นี้ไม่ได้ติดคุก หรือคุณลืมแท็ก`);
        }
    }

    else if (command === 'addcoin') {
        if (!isStaff) return message.reply("❌ ไม่มีสิทธิ์ครับ");
        const targetIdInput = args[0];
        const amount = parseInt(args[1]);
        if (!targetIdInput || !amount) return message.reply("❌ ใช้คำสั่ง: `!addcoin <DiscordID> <Amount>`");
        
        const cleanTargetId = targetIdInput.replace(/[^0-9]/g, '');
        const gameUser = await GameUser.findOne({ discordId: cleanTargetId });

        if (!gameUser) return message.reply("❌ ไม่พบข้อมูลสมาชิกในระบบ");
        await GameUser.updateOne({ _id: gameUser._id }, { $inc: { coins: amount } });
        
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) logChannel.send(`✅ เพิ่ม HamsterCoin ให้ น้อง${gameUser.nick} จำนวน ${amount} เหรียญ โดย ${message.author.username}`);
        message.reply(`✅ เพิ่มเหรียญสำเร็จ! ยอดคงเหลือ: ${(gameUser.coins + amount).toLocaleString()} coins`);
    }

    else if (command === 'syncranks') {
        if (!isStaff && !message.member.permissions.has(PermissionFlagsBits.Administrator)) return message.reply("❌ ไม่มีสิทธิ์ครับ");
        const statusMsg = await message.reply("⏳ กำลังเริ่มทำการ Sync ยศ... (กรุณารอสักครู่)");
        try {
            const allUsers = await GameUser.find({ discordId: { $exists: true, $ne: "" } });
            let count = 0;
            for (const user of allUsers) {
                await syncSingleUser(message.guild, user);
                count++;
                await new Promise(r => setTimeout(r, 200));
            }
            await statusMsg.edit(`✅ **Manual Sync Complete!** ตรวจสอบสมาชิกไปทั้งหมด ${count} คน`);
        } catch (err) {
            console.error(err);
            await statusMsg.edit("❌ เกิดข้อผิดพลาด");
        }
    }

    else if (command === 'reload') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        await loadConfig();
        message.reply("✅ **Configuration Reloaded!**");
    }

    else if (command === 'ads') {
        if (!isStaff) return message.reply("❌ ไม่มีสิทธิ์ครับ");
        const sheetName = args[0];
        const msgContent = args.slice(1).join(' ');
        const attachment = message.attachments.first();

        if (!sheetName) return message.reply("❌ กรุณาระบุชื่อ Sheet");
        if (!msgContent && !attachment) return message.reply("❌ ต้องใส่ข้อความ หรือ รูปภาพ อย่างน้อย 1 อย่าง");

        const statusMsg = await message.reply("⏳ กำลังดึงข้อมูล...");
        try {
            const response = await axios.get(process.env.GET_APP_URL, { params: { sheet: sheetName, mode: 'all_ids' } });
            const resData = response.data;
            if (resData.status !== 'success') return statusMsg.edit(`❌ Error: ${resData.message}`);

            const userIds = resData.data;
            if (!userIds || userIds.length === 0) return statusMsg.edit(`⚠️ ไม่พบ User ID ใน Sheet: ${sheetName}`);

            await statusMsg.edit(`✅ พบ **${userIds.length}** รายชื่อ กำลังส่ง...`);
            let successCount = 0, failCount = 0;
            
            // Send Async without blocking
            (async () => {
                for (const userId of userIds) {
                    try {
                        const cleanId = String(userId).trim();
                        if (!cleanId) continue;
                        const user = await client.users.fetch(cleanId);
                        const payload = {};
                        if (msgContent) payload.content = msgContent;
                        if (attachment) payload.files = [attachment.url];
                        await user.send(payload);
                        successCount++;
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    } catch (err) { failCount++; }
                }
                message.channel.send({
                    embeds: [new EmbedBuilder().setColor('#00FF00').setTitle('📢 สรุปผลการส่งโฆษณา (ADS)').setDescription(`**Sheet:** ${sheetName}`).addFields({ name: '✅ ส่งสำเร็จ', value: `${successCount}`, inline: true }, { name: '❌ ส่งไม่ผ่าน', value: `${failCount}`, inline: true })]
                });
            })();
        } catch (err) {
            console.error(err);
            await statusMsg.edit("❌ System Error");
        }
    }
});

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) try { await reaction.fetch(); } catch (e) { return; }
    
    const session = selectionSessions.get(reaction.message.id);
    if (session && session.userId === user.id) {
        const emoji = reaction.emoji.name;
        const courseData = configState.courseConfig[emoji];
        if (courseData) {
            selectionSessions.delete(reaction.message.id);
            await startInterview(user, courseData, session.guildId);
        }
    }
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    const userId = newState.member.id;
    if (!jailedUsers.has(userId)) return;

    const userData = jailedUsers.get(userId);

    // Escape Attempt
    if (oldState.channelId && !newState.channelId) {
        if (userData.timer) clearTimeout(userData.timer);
        const timePassed = Date.now() - userData.startTime;
        const remaining = userData.remainingTime - timePassed;

        if (remaining > 0) {
            jailedUsers.set(userId, { remainingTime: remaining, timer: null, startTime: null });
        } else {
            jailedUsers.delete(userId);
            manageJailVoice(oldState.guild);
        }
    }
    // Rejoin / Move
    else if (newState.channelId) {
        if (newState.channelId !== JAIL_CHANNEL_ID) await newState.setChannel(JAIL_CHANNEL_ID).catch(() => { });

        if (!userData.timer) { 
             const newTimer = setTimeout(() => { unjailUser(newState.member); }, userData.remainingTime);
             jailedUsers.set(userId, { remainingTime: userData.remainingTime, timer: newTimer, startTime: Date.now() });
        }
        manageJailVoice(newState.guild);
    }
});

module.exports = { client };