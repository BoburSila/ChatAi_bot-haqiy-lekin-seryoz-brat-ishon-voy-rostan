require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

const userModels = new Map();
const userLangs = new Map();

const messages = {
    uzb: {
        start: (name) => `Salom ${name}, o'zingiz uchun tilni tanlang!`,
        chooseModel: (name) => `${name}, endi siz o'zingiz uchun MODEL tanlang`,
        modelChosen: "✅ Model tanlandi: "
    },
    russ: {
        start: (name) => `Привет ${name}, выбери язык для себя!`,
        chooseModel: (name) => `${name}, теперь выберите себе МОДЕЛЬ`,
        modelChosen: "✅ Модель выбрана: "
    },
    usa: {
        start: (name) => `Hello ${name}, choose a language for yourself!`,
        chooseModel: (name) => `${name}, now choose a MODEL for you`,
        modelChosen: "✅ Model chosen: "
    }
};

const modelMap = {
    llama4: 'llama-3.1-70b',
    llama3: 'llama-3.1-8b-instant',
    chatGpt: 'chatgpt-4o',
    deepseek: 'deepseek-chat'
};

async function sendToGroq(message, model = 'llama-3.1-8b-instant') {
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
    const name = ctx.from.first_name;
    ctx.reply(`${name}, choose language for you\n\n${messages.uzb.start(name)}\n\n${messages.russ.start(name)}`,
        Markup.inlineKeyboard([
            Markup.button.callback('Uzbek 🇺🇿', 'uzb'),
            Markup.button.callback('Русский 🇷🇺', 'russ'),
            Markup.button.callback('English 🇺🇸', 'usa')
        ])
    );
});

bot.action(['uzb', 'russ', 'usa'], (ctx) => {
    const lang = ctx.match[0];
    const name = ctx.from.first_name;
    userLangs.set(ctx.from.id, lang);
    ctx.answerCbQuery();
    ctx.reply(messages[lang].chooseModel(name),
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
    const userMessage = ctx.message.text;
    const userModel = userModels.get(ctx.from.id) || 'llama-3.1-8b-instant';
    const reply = await sendToGroq(userMessage, userModel);
    ctx.reply(reply);
});

bot.launch();
console.log("Bot ishlayapti!");
