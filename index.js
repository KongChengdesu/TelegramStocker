const express = require('express');
const app = express();
const port = 8080;

app.get('/', (req, res) => res.send('Coé menó tá olhando oq'));

app.listen(port, function() { });


const { GoogleSpreadsheet } = require('google-spreadsheet');
const TelegramBot = require('node-telegram-bot-api');
const process = require('process');
require('dotenv').config();
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, {polling: true});

const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets', 
    'https://www.googleapis.com/auth/drive.file'
];

var doc;

async function main() {
    import('google-auth-library').then((module) => {
        const jwt = new module.JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            scopes: SCOPES,
        });
        doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, jwt);
    });
}

main().catch(console.error);

const startRm = {
    reply_markup: {
        keyboard: [
            [
                {
                    text: '登记出货',
                }
            ],
            [
                {
                    text: '登记进货',
                }
            ]
        ],
        is_persistent: false,
        resize_keyboard: true,
        one_time_keyboard: true
    }
}

bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "请选择你要进行的操作", startRm);
});

var waitingForProduct = 0;
bot.on('message', async (msg) => {
    if(!msg.text) return;
    if(msg.text.startsWith('/')) return;
    if(waitingForProduct != 0){
        switch(waitingForProduct){
            case -1:
                registerArrival2(msg,msg.text);
                break;
            case -2:
                registerArrival3(msg,msg.text);
                break;
            case -3:
                registerArrival4(msg,msg.text);
                break;
            case 1:
                registerShipment2(msg,msg.text);
                break;
            case 2:
                registerShipment3(msg,msg.text);
                break;
            case 3:
                registerShipment4(msg,msg.text);
                break;
        }
        return;
    }
    if(msg.text.match(/登记出货/)){
        registerShipment(msg);
        return;
    }
    if(msg.text.match(/登记进货/)){
        registerArrival(msg);
        return;
    }
});

var shipment = {};
async function registerShipment(msg){
    shipment = {};
    const chatId = msg.chat.id;
    //pull a list from google sheet    
    await doc.loadInfo();
    const productSheet = doc.sheetsByTitle['货物列表'];
    const products = await productSheet.getRows({
        offset: 1,
        limit: 100
    });
    //make a rm keyboard out of product list
    const opts = {
        reply_markup: {
            keyboard: [
            ],
            is_persistent: false,
            resize_keyboard: true,
            one_time_keyboard: true
        }
    }
    shipment.products = [];
    shipment.rm = opts;
    for (let i = 0; i < products.length; i++) {
        const row = products[i];
        const name = row.get('货物名称');
        if (name != null) {
            opts.reply_markup.keyboard.push([{text: name}]);
            shipment.products.push(name);
        }
    }
    bot.sendMessage(chatId, "请选择货物",opts);
    waitingForProduct = 1;
}

async function registerShipment2(msg,productName){
    const chatId = msg.chat.id;
    if(!shipment.products.includes(productName)){
        bot.sendMessage(chatId, "货物不存在，请重新选择", shipment.rm);
        return;
    }
    shipment.product = productName;
    waitingForProduct = 2;
    bot.sendMessage(chatId, "请输入货物数量");
}

async function registerShipment3(msg,productQtd){
    const chatId = msg.chat.id;
    if(!productQtd.match(/^\d+$/)){
        bot.sendMessage(chatId, "货物数量不正确，请重新输入");
        return;
    }
    shipment.qtd = productQtd;
    waitingForProduct = 3;
    const opts = {
        reply_markup: {
            keyboard: [
                [
                    {
                        text: '否',
                    }
                ]
            ],
            is_persistent: false,
            resize_keyboard: true,
            one_time_keyboard: true
        }
    }
    bot.sendMessage(chatId, "请输入货物价格，或按否跳过", opts);
}

async function registerShipment4(msg,productPrice){
    const chatId = msg.chat.id;
    if(productPrice.match(/否/)){
        shipment.price = 0;
        finalizeShipment(msg);
        return;
    }
    if(!productPrice.match(/^\d+$/)){
        bot.sendMessage(chatId, "货物价格不正确，请重新输入");
        return;
    }
    shipment.price = productPrice;
    finalizeShipment(msg);
}

async function finalizeShipment(msg){
    //save to google sheet
    const shipmentSheet = doc.sheetsByTitle['出货记录'];
    const row = await shipmentSheet.addRow({
        '货物名称': shipment.product,
        '数量': shipment.qtd,
        '价格': shipment.price,
        '时间': new Date().toLocaleString(),
        '用户': msg.from.username || msg.from.first_name
    });
    bot.sendMessage(msg.chat.id, "出货记录已保存", startRm);
    waitingForProduct = 0;
}

var arrival = {};
async function registerArrival(msg){
    arrival = {};
    const chatId = msg.chat.id;
    //pull a list from google sheet    
    await doc.loadInfo();
    const productSheet = doc.sheetsByTitle['货物列表'];
    const products = await productSheet.getRows({
        offset: 1,
        limit: 100
    });
    //make a rm keyboard out of product list
    const opts = {
        reply_markup: {
            keyboard: [
            ],
            is_persistent: false,
            resize_keyboard: true,
            one_time_keyboard: true
        }
    }
    arrival.products = [];
    arrival.rm = opts;
    for (let i = 0; i < products.length; i++) {
        const row = products[i];
        const name = row.get('货物名称');
        if (name != null) {
            opts.reply_markup.keyboard.push([{text: name}]);
            arrival.products.push(name);
        }
    }
    bot.sendMessage(chatId, "请选择货物",opts);
    waitingForProduct = -1;
}

async function registerArrival2(msg,productName){
    const chatId = msg.chat.id;
    if(!arrival.products.includes(productName)){
        bot.sendMessage(chatId, "货物不存在，请重新选择", arrival.rm);
        return;
    }
    arrival.product = productName;
    waitingForProduct = -2;
    bot.sendMessage(chatId, "请输入货物数量");
}

async function registerArrival3(msg,productQtd){
    const chatId = msg.chat.id;
    if(!productQtd.match(/^\d+$/)){
        bot.sendMessage(chatId, "货物数量不正确，请重新输入");
        return;
    }
    arrival.qtd = productQtd;
    waitingForProduct = -3;
    const opts = {
        reply_markup: {
            keyboard: [
                [
                    {
                        text: '否',
                    }
                ]
            ],
            is_persistent: false,
            resize_keyboard: true,
            one_time_keyboard: true
        }
    }
    bot.sendMessage(chatId, "请输入货物价格，或按否跳过", opts);
}

async function registerArrival4(msg,productPrice){
    const chatId = msg.chat.id;
    if(productPrice.match(/否/)){
        arrival.price = 0;
        finalizeArrival(msg);
        return;
    }
    if(!productPrice.match(/^\d+$/)){
        bot.sendMessage(chatId, "货物价格不正确，请重新输入");
        return;
    }
    arrival.price = productPrice;
    finalizeArrival(msg);
}

async function finalizeArrival(msg){
    //save to google sheet
    const arrivalSheet = doc.sheetsByTitle['进货记录'];
    const row = await arrivalSheet.addRow({
        '货物名称': arrival.product,
        '数量': arrival.qtd,
        '价格': arrival.price,
        '时间': new Date().toLocaleString(),
        '用户': msg.from.username || msg.from.first_name
    });
    bot.sendMessage(msg.chat.id, "进货记录已保存", startRm);
    waitingForProduct = 0;
}