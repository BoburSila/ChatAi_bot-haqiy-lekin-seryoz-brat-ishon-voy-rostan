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

// ISHONCHLI VA STABLE MODELLAR
const modelMap = {
    llama4: 'meta-llama/llama-4-scout-17b-16e-instruct',
    llama3: 'meta-llama/llama-4-scout-17b-16e-instruct', 
    chatGpt: 'meta-llama/llama-4-scout-17b-16e-instruct',
    deepseek: 'meta-llama/llama-4-scout-17b-16e-instruct'
};

async function sendToGroq(message, model = 'llama-3.1-8b-instant') {
    try {
        console.log(`🤖 So'rov: ${message.substring(0, 50)}...`);
        console.log(`🔧 Model: ${model}`);
        
        const response = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: model,
                messages: [
                    { 
                        role: 'system', 
                        content: "Siz foydalanuvchiga yordam beradigan yaxshi bot ekansiz. Qisqa va aniq javob bering." 
                    },
                    { role: 'user', content: message }
                ],
                max_tokens: 1024,
                temperature: 0.7
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.API_KEY}`,
                    "Content-Type": "application/json"
                },
                timeout: 30000
            }
        );
        
        console.log("✅ Groq API muvaffaqiyatli ishladi!");
        return response.data.choices[0].message.content.trim();
        
    } catch (error) {
        console.error("❌ Groq API xatosi:", error.response?.data || error.message);
        
        // Doiraviy xatoni oldini olish
        if (error.response?.data?.error?.code === 'model_decommissioned') {
            console.log("🔄 Model eskirgan, ishonchli modelga o'tilmoqda...");
            // Boshqa modelga o'tish
            const fallbackModel = 'mixtral-8x7b-32768';
            if (model !== fallbackModel) {
                return await sendToGroq(message, fallbackModel);
            } else {
                return "❌ Hozircha AI xizmati ishlamayapti. Iltimos, keyinroq urinib ko'ring.";
            }
        }
        
        if (error.response?.status === 429) {
            return "⚠️ So'rovlar chegarasidan o'tib ketdingiz. Iltimos, bir daqiqa kutib turing.";
        }
        
        return "❌ Texnik xatolik yuz berdi. Iltimos, keyinroq qayta urinib ko'ring.";
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
    const userModel = userModels.get(ctx.from.id) || 'llama-3.1-8b-instant';

    await ctx.reply('⏳ Javob tayyorlanmoqda...');
    const javob = await sendToGroq(userMessage, userModel);
    await ctx.reply(javob);
});

bot.launch().then(() => {
    console.log("✅ Bot muvaffaqiyatli ishga tushdi!");
}).catch(error => {
    console.error("❌ Bot ishga tushmadi:", error);
});

// Replit uchun Express server
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>🤖 ChatGPT Bot</title>
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                    h1 { color: #2c3e50; }
                    .status { color: #27ae60; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1>🤖 ChatGPT Bot - Bobur</h1>
                <p class="status">✅ Bot faol holatda ishlamoqda</p>
                <p>Telegramdan botga o'ting</p>
            </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`🌐 Server ${PORT} portda ishga tushdi`);
});