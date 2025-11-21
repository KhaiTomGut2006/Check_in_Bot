const SystemConfig = require('../models/SystemConfig');
const CourseConfig = require('../models/CourseConfig');

// ข้อมูล Default
const DEFAULT_COMMON_QUESTIONS = [
  { key: 'Name_Surname', question: "ไหนขอ ชื่อ-นามสกุล เราหน่อย \n[ตัวอย่างคำตอบ: นาย แฮมเต้อ หล่อดี]" },
  { key: 'Nickname', question: "เอ้ย ลืมถามชื่อเล่นของชื่อเล่นหน่อย \n[ตัวอย่างคำตอบ: โฟกัส]" },
  { key: 'Phone', question: "เบอร์โทรศัพท์ที่น้องใช้สมัครผ่านหน้าเว็บคืออะไรอ่ะ" },
  { key: 'School', question: "เรียนอยู่โรงเรียนอะไรอ่ะเรา \n[ตัวอย่างคำตอบ: โรงเรียนสาธิต...]" },
  { key: 'Age', question: "เรียนอยู่ชั้นไหนอ่ะเรา \n[ตัวอย่างคำตอบ: ม.6]" },
  { key: 'Line', question: "ขอชื่อ Line หน่อยครับ \n[ตัวอย่างคำตอบ: focus_hamster]" }
];

const DEFAULT_COURSES = [
    {
        emoji: "🎮",
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
    {
        emoji: "⭐",
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
    }
];

// Object เก็บ State ที่จะแชร์ให้ Bot ใช้งาน
const configState = {
    commonQuestions: [],
    courseConfig: {}
};

async function loadConfig() {
    console.log("🔄 Loading Configuration...");
    try {
        // 1. Load Common Questions
        let sysConfig = await SystemConfig.findOne({ configName: 'maincheckin_config' });
        if (!sysConfig) {
            console.log("⚠️ No Common Questions found, Seeding default...");
            sysConfig = await SystemConfig.create({
                configName: 'maincheckin_config',
                commonQuestions: DEFAULT_COMMON_QUESTIONS
            });
        }
        configState.commonQuestions = sysConfig.commonQuestions;

        // 2. Load Courses
        let courses = await CourseConfig.find({});
        if (courses.length === 0) {
            console.log("⚠️ No Courses found, Seeding default...");
            courses = await CourseConfig.insertMany(DEFAULT_COURSES);
        }

        configState.courseConfig = {};
        courses.forEach(c => {
            configState.courseConfig[c.emoji] = {
                roleId: c.roleId,
                courseName: c.courseName,
                displayName: c.displayName,
                sheetName: c.sheetName,
                specificQuestions: c.specificQuestions
            };
        });

        console.log(`✅ Config Loaded: ${configState.commonQuestions.length} Questions, ${Object.keys(configState.courseConfig).length} Courses.`);
    } catch (err) {
        console.error("❌ Error loading config:", err);
    }
}

module.exports = {
    configState,
    loadConfig
};