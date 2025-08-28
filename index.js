// bot.js — Clean & Styled (no LLM/RAG)

const {
  Client,
  GatewayIntentBits,
  Events,
  Partials,
  EmbedBuilder,
} = require("discord.js");
const axios = require("axios");
require("dotenv").config();

const token = process.env.DISCORD_TOKEN;
const prefix = "!";

// ──────────────────────────────────────────────────────────
// THEME — สี/อีโมจิ/ข้อความตกแต่ง
// ──────────────────────────────────────────────────────────
const THEME = {
  colorPrimary: 0x6c5ce7,     // ม่วงพาสเทล
  colorSuccess: 0x00c853,      // เขียว
  colorWarn: 0xffc107,         // เหลือง
  colorDanger: 0xd32f2f,       // แดง
  brand: "Hamster Check-in",
  emoji: {
    wave: "👋",
    star: "✨",
    pen: "🖊️",
    lock: "🔒",
    inbox: "📥",
    check: "✅",
    info: "ℹ️",
    spark: "⚡",
    role: "🎖️",
    save: "💾",
  },
  footer: "Your data is used for onboarding only.",
  bannerUrl:
    "https://i.postimg.cc/MKBnP3Rg/nutorr.png", // ใช้ลิงก์ postimg.cc ที่ผู้ใช้ให้มา
};

// ──────────────────────────────────────────────────────────
// Reaction Role Config — ตั้งค่า emoji → roleId
// ──────────────────────────────────────────────────────────
const reactionRoleConfig = {
  '👑': '1410273271588585567',
};

// ──────────────────────────────────────────────────────────
// Utils
// ─────────────────────────────────────────────────────────-
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function progressBar(step, total, width = 14) {
  // แสดง bar ชัดๆ เช่น ▰▰▰▰▰▱▱▱▱▱▱▱▱▱ (5/14)
  const ratio = Math.max(0, Math.min(1, step / total));
  const filled = Math.round(ratio * width);
  return `${"▰".repeat(filled)}${"▱".repeat(width - filled)}  (${step}/${total})`;
}

function baseEmbed({
  title,
  description,
  color = THEME.colorPrimary,
  thumbnail = null,
  image = null,
  fields = [],
  footer = THEME.footer,
}) {
  const emb = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setDescription(description && description.length > 0 ? description : null)
    .setTimestamp();

  if (thumbnail) emb.setThumbnail(thumbnail);
  if (image) emb.setImage(image);
  if (fields?.length) emb.addFields(fields);
  if (footer) emb.setFooter({ text: `${THEME.brand} • ${footer}` });

  return emb;
}

// ──────────────────────────────────────────────────────────
// ส่งข้อมูลไป WebApp/Sheet
// ──────────────────────────────────────────────────────────
async function sendDataToWebApp(data) {
  try {
    const WEB_APP_URL = process.env.WEB_APP_URL;
    if (!WEB_APP_URL) {
      console.error("WEB_APP_URL is not defined in .env!");
      return null;
    }
    const res = await axios.post(WEB_APP_URL, data, {
      headers: { "Content-Type": "application/json" },
      timeout: 15000,
    });
    return res.data ?? null;
  } catch (e) {
    console.error("ส่งข้อมูลไป WebApp ไม่สำเร็จ:", e.message);
    return null;
  }
}

// ──────────────────────────────────────────────────────────
// ถามคำถามใน DM (ไม่ใช้ LLM) + ตกแต่งสวยๆ
// ──────────────────────────────────────────────────────────
async function ask(dm, userId, step, total, label, placeholder, validator) {
  // Header embed ของแต่ละข้อ
  const emb = baseEmbed({
    title: `${THEME.emoji.pen} ${label}`,
    description:
      `${progressBar(step, total)}\n` +
      `\n> ตัวอย่าง: **${placeholder}**\n` +
      `\nพิมพ์คำตอบของคุณได้เลยในแชทนี้นะ`,
    image: THEME.bannerUrl,
  });

  await dm.send({ embeds: [emb] });
  await dm.sendTyping();

  const filter = (m) => m.author.id === userId && !m.author.bot;

  while (true) {
    try {
      const collected = await dm.awaitMessages({
        filter,
        max: 1,
        time: 180000,
        errors: ["time"],
      });

      const msg = collected.first();
      const text = (msg?.content || "").trim();

      let valid = true;
      let warn = "";

      if (validator) {
        const res = validator(text);
        if (res !== true) {
          valid = false;
          warn = typeof res === "string" ? res : "คำตอบยังไม่ถูกต้อง ลองใหม่นะ";
        }
      } else {
        if (!text) {
          valid = false;
          warn = "ขอให้ไม่เว้นว่างนะ";
        }
      }

      if (valid) {
        try {
          await msg.react(THEME.emoji.check);
        } catch {}
        // ส่ง embed Confirm
        const okEmb = baseEmbed({
          title: `${THEME.emoji.check} รับคำตอบแล้ว`,
          description: `**คำตอบ:** ${text}`,
          color: THEME.colorSuccess,
        });
        await dm.send({ embeds: [okEmb] });
        return text;
      } else {
        const warnEmb = baseEmbed({
          title: `กรอกใหม่หน่อยนะ`,
          description: `${warn}\n\nลองตอบอีกครั้งได้เลย`,
          color: THEME.colorWarn,
        });
        await dm.send({ embeds: [warnEmb] });
      }
    } catch (e) {
      const timeoutEmb = baseEmbed({
        title: "หมดเวลาในการตอบ",
        description:
          "หากอยากเริ่มใหม่ ให้พิมพ์ `!checkin` ในห้องอีกครั้งนะ",
        color: THEME.colorDanger,
      });
      await dm.send({ embeds: [timeoutEmb] });
      throw e;
    }
  }
}

// ตัวตรวจพื้นฐาน
const validators = {
  nonEmpty: (s) => (s.trim().length ? true : "ขอให้ไม่เว้นว่างนะ"),
  age: (s) => {
    const n = Number(s);
    if (!Number.isInteger(n)) return "พิมพ์เป็นจำนวนเต็ม เช่น 20";
    if (n < 5 || n > 120) return "ช่วงอายุไม่สมเหตุสมผล (5–120)";
    return true;
  },
  maxLen: (n) => (s) =>
    s.length <= n ? true : `ข้อความยาวเกินไป (สูงสุด ${n} ตัวอักษร)`,
};

// ──────────────────────────────────────────────────────────
// ฝั่ง Role: ส่ง embed ตัวเลือกยศ + ใส่ reaction
// ──────────────────────────────────────────────────────────
async function sendRoleRequest(dm) {
  const pairs = Object.entries(reactionRoleConfig);
  if (pairs.length === 0) {
    const emb = baseEmbed({
      title: "ยังไม่ได้ตั้งค่า Reaction Roles",
      description:
        "โปรดเพิ่มค่าใน `reactionRoleConfig` ก่อน (emoji → roleId)\nตัวอย่าง:\n```js\nconst reactionRoleConfig = {\n  '👑': '1410273271588585567',\n};\n```",
      color: THEME.colorWarn,
    });
    return dm.send({ embeds: [emb] });
  }

  const desc = pairs
    .map(([emoji, roleId]) => `• ${emoji} → <@&${roleId}>`)
    .join("\n");

  const emb = baseEmbed({
    title: `${THEME.emoji.role} เลือกยศของคุณ`,
    description:
      "กดอีโมจิที่ต้องการด้านล่าง บอทจะมอบยศให้อัตโนมัติ\n\n" + desc,
    image: THEME.bannerUrl,
  });

  const msg = await dm.send({ embeds: [emb] });
  for (const [emoji] of pairs) {
    try {
      await msg.react(emoji);
      await wait(350);
    } catch (e) {
      console.error(`react ${emoji} fail:`, e.message);
    }
  }
  return msg;
}

// ──────────────────────────────────────────────────────────
// Client / Intents
// ──────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

const reactionSessions = new Map();

client.on(Events.ClientReady, () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ──────────────────────────────────────────────────────────
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (message.content !== prefix + "checkin") return;

  const member = message.member;

  try {
    const dm = await member.createDM();

    // Intro
    const intro = baseEmbed({
      title: `${THEME.emoji.wave} ยินดีต้อนรับสู่ ${THEME.brand}`,
      description:
        `${THEME.emoji.inbox} พี่ส่งคำถามไปใน DM แล้วนะ เพื่อความเป็นส่วนตัวของข้อมูล\n` +
        `${THEME.emoji.lock} ข้อมูลใช้เพื่อ onboarding เท่านั้น\n` +
        `${THEME.emoji.star} ใช้เวลาประมาณ 2–3 นาที`,
      image: THEME.bannerUrl,
    });

    try {
      await dm.send({ embeds: [intro] });
    } catch {
      // ถ้า DM ไม่ได้ แจ้งในห้อง
      await message.reply({
        embeds: [
          baseEmbed({
            title: "เปิด DM ไม่ได้",
            description:
              "ขอให้เปิด DM จากสมาชิกเซิร์ฟเวอร์ชั่วคราว แล้วพิมพ์ `!checkin` อีกครั้งนะ",
            color: THEME.colorWarn,
          }),
        ],
      });
      return;
    }

    // Warm-up
    const warm = baseEmbed({
      title: `${THEME.emoji.spark} เริ่มเช็คอินกัน!`,
      description:
        "ตอบสั้นหรือยาวได้ตามสะดวก ถ้าพร้อมแล้วเริ่มกันเลย",
      color: THEME.colorPrimary,
    });
    await dm.send({ embeds: [warm] });
    await dm.sendTyping();

    // Q&A — 7 ข้อ
    const total = 7;
    const name = await ask(
      dm,
      member.id,
      1,
      total,
      "ชื่อ-นามสกุล",
      "สมชาย ใจดี",
      (s) => validators.nonEmpty(s) === true && validators.maxLen(60)(s) === true
        ? true
        : validators.nonEmpty(s) !== true
          ? validators.nonEmpty(s)
          : validators.maxLen(60)(s)
    );

    const nickname = await ask(
      dm,
      member.id,
      2,
      total,
      "ชื่อเล่น",
      "ชายน้อย",
      validators.maxLen(24)
    );

    const age = await ask(
      dm,
      member.id,
      3,
      total,
      "อายุ",
      "20",
      validators.age
    );

    const q1 = await ask(
      dm,
      member.id,
      4,
      total,
      "เจอกิจกรรมนี้จากที่ไหน",
      "TikTok / CampHub / เพื่อนชวน",
      validators.nonEmpty
    );

    const why = await ask(
      dm,
      member.id,
      5,
      total,
      "เหตุผลที่ตัดสินใจสมัคร/สนใจ",
      "ชอบเนื้อหาในคลิป / โปรโมชั่นน่าสนใจ / สนใจคอร์ส",
      validators.nonEmpty
    );

    const q2 = await ask(
      dm,
      member.id,
      6,
      total,
      "เป้าหมายต่อไป",
      "อยากเข้าวิศวะคอม ม.มหิดล",
      validators.nonEmpty
    );

    const q3 = await ask(
      dm,
      member.id,
      7,
      total,
      "พื้นฐาน/ประสบการณ์",
      "เคยทำเกม Roblox / เคยเรียนเขียนโค้ด",
      validators.nonEmpty
    );

    // Recap ก่อนบันทึก
    const recap = baseEmbed({
      title: `${THEME.emoji.info} สรุปข้อมูลก่อนบันทึก`,
      color: THEME.colorPrimary,
      fields: [
        { name: "ชื่อ-นามสกุล", value: name, inline: true },
        { name: "ชื่อเล่น", value: nickname || "-", inline: true },
        { name: "อายุ", value: String(age), inline: true },
        { name: "พบจาก", value: q1, inline: true },
        { name: "เหตุผล", value: why, inline: true },
        { name: "เป้าหมาย", value: q2, inline: true },
        { name: "พื้นฐาน", value: q3, inline: false },
      ],
    });
    await dm.send({ embeds: [recap] });

    await dm.sendTyping();
    await wait(700);

    // ส่งไป WebApp
    const payload = {
      Name_Surname: name,
      Nickname: nickname,
      Age: age,
      From: q1,
      Why: why,
      Goal: q2,
      Basic: q3,
    };

    const savingEmb = baseEmbed({
      title: `${THEME.emoji.save} กำลังบันทึกข้อมูล...`,
      description: "รอสักครู่นะ",
      color: THEME.colorPrimary,
    });
    const savingMsg = await dm.send({ embeds: [savingEmb] });

    let sheetResult = await sendDataToWebApp(payload);

    function extractIndex(obj) {
      if (!obj) return undefined;
      if (typeof obj === "object") {
        for (const k of Object.keys(obj)) {
          if (k.toLowerCase() === "index") return obj[k];
        }
      }
      return undefined;
    }

    let indexInSheet;
    if (sheetResult) {
      if (typeof sheetResult === "object") {
        indexInSheet = extractIndex(sheetResult);
      } else if (typeof sheetResult === "string") {
        try {
          const parsed = JSON.parse(sheetResult);
          indexInSheet = extractIndex(parsed);
        } catch {
          if (!isNaN(sheetResult)) indexInSheet = sheetResult;
        }
      }
    }

    // อัปเดตข้อความผลลัพธ์บันทึก
    const savedEmb = baseEmbed({
      title: `${THEME.emoji.check} บันทึกสำเร็จ`,
      description:
        indexInSheet !== undefined
          ? `รับข้อมูลเรียบร้อยแล้ว (ลำดับ: **${indexInSheet}**)`
          : "รับข้อมูลเรียบร้อยแล้ว",
      color: THEME.colorSuccess,
    });
    await savingMsg.edit({ embeds: [savedEmb] });

    // เลือกยศ
    const nextEmb = baseEmbed({
      title: `${THEME.emoji.role} ขั้นตอนสุดท้าย: เลือกยศ`,
      description: "กดอีโมจิด้านล่างเพื่อเลือกระดับยศของคุณ",
      color: THEME.colorPrimary,
    });
    await dm.send({ embeds: [nextEmb] });

    const roleMsg = await sendRoleRequest(dm);

    // เก็บ session
    reactionSessions.set(roleMsg.id, {
      guildId: member.guild.id,
      userId: member.id,
      nickname,
      index: indexInSheet,
    });
  } catch (err) {
    console.error("DM flow error:", err);
    await message.reply({
      embeds: [
        baseEmbed({
          title: "ส่ง DM ไม่สำเร็จ",
          description:
            "ลองตรวจสอบการตั้งค่าความเป็นส่วนตัว หรือพิมพ์ `!checkin` เพื่อเริ่มใหม่อีกครั้งนะ",
          color: THEME.colorDanger,
        }),
      ],
    });
  }
});

// ──────────────────────────────────────────────────────────
// Reaction → มอบยศ + เปลี่ยนชื่อเล่นสไตล์ `Role-Index-Nickname`
// ──────────────────────────────────────────────────────────
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error("fetch reaction fail:", err);
      return;
    }
  }
  if (user.bot) return;

  const session = reactionSessions.get(reaction.message.id);
  if (!session || session.userId !== user.id) return;

  const emoji = reaction.emoji.name;
  const roleId = reactionRoleConfig[emoji];
  if (!roleId) return;

  try {
    const guild = await client.guilds.fetch(session.guildId);
    if (!guild) return;

    const member = await guild.members.fetch(session.userId);
    if (!member) return;

    const role = guild.roles.cache.get(roleId);
    if (!role) return;

    await member.roles.add(role);

    // ตั้งชื่อเล่นแบบสวยๆ
    const roleName = role.name || "Role";
    const index = session.index ?? "";
    const nickname = session.nickname || "";

    const newNick = `${roleName}-${index}-${nickname}`
      .replace(/--+/g, "-")
      .replace(/^-|-$/g, "");

    try {
      await member.setNickname(newNick);
    } catch (e) {
      console.error("เปลี่ยนชื่อเล่นไม่สำเร็จ:", e.message);
    }

    const doneEmb = baseEmbed({
      title: `${THEME.emoji.check} มอบยศสำเร็จ`,
      description: `มอบยศ **${role.name}** ใน **${guild.name}**\nชื่อเล่นใหม่: **${newNick}**`,
      color: THEME.colorSuccess,
    });

    await user.send({ embeds: [doneEmb] });
    reactionSessions.delete(reaction.message.id);
  } catch (e) {
    console.error("เพิ่มยศจาก DM ผิดพลาด:", e);
  }
});

// ──────────────────────────────────────────────────────────
client.login(token);
