require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);

const userModels = new Map();
const userLangs = new Map();

const messages = {
    uzb: {
        start: (name) => `Salom ${name}, o'zingiz uchun tilni tanlang!`,
        chooseModel: (name) => `${name}, endi siz o'zingiz uchun MODEL tanlang`,
        modelChosen: "✅ Model tanlandi: ",
        needJoin: "Siz hali kanallarga a'zo bo'lmagansiz. Iltimos, avval a'zo bo'ling:"
    },
    russ: {
        start: (name) => `Привет ${name}, выбери язык для себя!`,
        chooseModel: (name) => `${name}, теперь выберите себе МОДЕЛЬ`,
        modelChosen: "✅ Модель выбрана: ",
        needJoin: "Пожалуйста, сначала подпишитесь на канал."
    },
    usa: {
        start: (name) => `Hello ${name}, choose a language for yourself!`,
        chooseModel: (name) => `${name}, now choose a MODEL for you`,
        modelChosen: "✅ Model chosen: ",
        needJoin: "Please join the channel first."
    }
};

const modelMap = {
    llama4: 'llama3-70b-8192',
    llama3: 'llama3-8b-8192',
    chatGpt: 'mixtral-8x7b-32768',
    deepseek: 'gemma-7b-it'
};

async function sendToGroq(message, model = 'llama3-8b-8192') {
    try {
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: model,
                messages: [
                    { role: 'system', content: "Siz foydalanuvchiga yordam beradigan bot ekansiz." },
                    { role: 'user', content: message }
                ]
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );
        return response.data.choices[0].message.content.trim();
    } catch (error) {
        console.error("Groq API xatosi:", error.response?.data || error.message);
        return "❌ Groq javobida xatolik yuz berdi.";
    }
}

bot.start((ctx) => {
    const id = ctx.from.id;
    const name = ctx.from.first_name;
    const userText = ctx.message.text;
    const urll = `Obunachilar/${id}.txt`;

    const sana = new Date().toDateString();
    const vaqt = new Date().toTimeString().slice(0, 8);
    const mtn = `=====${name}=====\n\n`;
    const matn = `\n\n=====${vaqt}  ${sana}=====\n\n${userText}`;

    if (!fs.existsSync('Obunachilar')) fs.mkdirSync('Obunachilar');
    fs.appendFileSync(urll, mtn + matn, 'utf8');

    ctx.reply(
        `${name}, choose language for you\n\n${messages.uzb.start(name)}\n\n${messages.russ.start(name)}`,
        Markup.inlineKeyboard([
            Markup.button.callback('Uzbek 🇺🇿', 'uzb'),
            Markup.button.callback('Русский 🇷🇺', 'russ'),
            Markup.button.callback('English 🇺🇸', 'usa')
        ])
    );
});

bot.action(['uzb', 'russ', 'usa'], async (ctx) => {
    const lang = ctx.match[0];
    const name = ctx.from.first_name;
    userLangs.set(ctx.from.id, lang);

    try {
        const member = await ctx.telegram.getChatMember('@BoburSila', ctx.from.id);
        if (member.status === 'left') {
            return ctx.reply(
                messages[lang].needJoin,
                Markup.inlineKeyboard([
                    [Markup.button.url(" A'zo bo'lish", 'https://t.me/BoburSila')]
                ])
            );
        }
    } catch (error) {
        console.error("Kanal tekshirish xatosi:", error.message);
        return ctx.reply(`❌ Kanal tekshirishda xatolik: ${error.description || error.message}`);
    }

    ctx.answerCbQuery();
    ctx.reply(
        messages[lang].chooseModel(name),
        Markup.inlineKeyboard([
            Markup.button.callback('llama 4 🦙', 'llama4'),
            Markup.button.callback('llama 3 🐑', 'llama3'),
            Markup.button.callback('ChatGpt 🧠', 'chatGpt'),
            Markup.button.callback('Deepseek 🔍', 'deepseek')
        ])
    );
});

bot.action(['llama4', 'llama3', 'chatGpt', 'deepseek'], (ctx) => {
    const modelKey = ctx.match[0];
    const model = modelMap[modelKey];
    const lang = userLangs.get(ctx.from.id) || 'uzb';

    userModels.set(ctx.from.id, model);
    ctx.answerCbQuery();
    ctx.reply(`${messages[lang].modelChosen}${modelKey}`);
});

bot.on('text', async (ctx) => {
    const lang = userLangs.get(ctx.from.id) || 'uzb';
    const userMessage = ctx.message.text;
    const userModel = userModels.get(ctx.from.id) || 'llama3-8b-8192';

    const javob = await sendToGroq(userMessage, userModel);
    ctx.reply(javob);
});

bot.launch();
console.log("✅ Bot ishga tushdi!");
