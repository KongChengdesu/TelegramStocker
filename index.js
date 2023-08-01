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

async function initialize() {
    import('google-auth-library').then((module) => {
        const jwt = new module.JWT({
            email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
            key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            scopes: SCOPES,
        });
        doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, jwt);
    });
}

initialize().catch(console.error);

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

async function startSequence(){
    await bot.sendMessage(msg.chat.id, "请选择你要进行的操作", startRm);
}

var inputPromise;
bot.on('message', async (msg) => {
    if(!msg.text) return;
    if(inputPromise){
        if(msg.text.match(/取消/)){
            inputPromise.resolve(null);
            inputPromise = null;
            return;
        }
        console.log(msg.text)
        inputPromise.resolve(msg.text);
        inputPromise = null;
        return;
    }
    if(msg.text.startsWith('/start')){
        startSequence();
        return;
    };
    if(msg.text.match(/登记出货/)){
        registerShipment(msg);
        return;
    }
    if(msg.text.match(/登记进货/)){
        registerArrival(msg);
        return;
    }
});

async function waitForInput(){
    //save promise to global variable so we can resolve it later
    inputPromise = new Promise((resolve, reject) => {
        inputPromise.resolve = resolve;
        inputPromise.reject = reject;
    });
    return inputPromise;
}

async function registerShipment(msg){
    var shipment = {};
    const chatId = msg.chat.id;
    //pull a list from google sheet    
    await doc.loadInfo();
    const productSheet = doc.sheetsByTitle['货物列表'];
    const products = await productSheet.getRows({
        offset: 0,
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
    for (let i = 0; i < products.length; i++) {
        const row = products[i];
        const name = row.get('货物名称');
        if (name != null) {
            opts.reply_markup.keyboard.push([{text: name}]);
            shipment.products.push(name);
        }
    }
    await bot.sendMessage(chatId, "请选择货物",opts);
    shipment.product = await waitForInput();
    if(shipment.product == null) return;
    while(!shipment.products.includes(shipment.product)){
        await bot.sendMessage(chatId, "货物不存在，请重新选择", opts);
        shipment.product = await waitForInput();
        if(shipment.product == null) return;
    }
    await bot.sendMessage(chatId, "请输入货物数量");
    shipment.qtd = await waitForInput();
    if(shipment.qtd == null) return;
    while(!shipment.qtd.match(/^\d+$/)){
        await bot.sendMessage(chatId, "货物数量不正确，请重新输入");
        shipment.qtd = await waitForInput();
        if(shipment.qtd == null) return;
    }
    const opts2 = {
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
    await bot.sendMessage(chatId, "请输入货物价格，或按否跳过", opts2);
    shipment.price = await waitForInput();
    if(shipment.price == null) return;
    if(shipment.price.match(/否/)){
        shipment.price = 0;
    }else{
        while(!shipment.price.match(/^\d+$/)){
            await bot.sendMessage(chatId, "货物价格不正确，请重新输入");
            shipment.price = await waitForInput();
            if(shipment.price == null) return;
        }
    }
    await bot.sendMessage(chatId, "请输入日期（格式日-月-年，比如20-12-2020），或按否跳过", opts2);
    shipment.date = await waitForInput();
    if(shipment.date == null) return;
    if(shipment.date.match(/否/)){
        shipment.date = new Date().toLocaleString();
    }else{
        while(!shipment.date.match(/^\d{1,2}-\d{1,2}-\d{4}$/)){
            await bot.sendMessage(chatId, "日期格式不正确，请重新输入");
            shipment.date = await waitForInput();
            if(shipment.date == null) return;
        }
    }
    //save to google sheet
    const shipmentSheet = doc.sheetsByTitle['出货记录'];
    const row = await shipmentSheet.addRow({
        '货物名称': shipment.product,
        '数量': shipment.qtd,
        '价格': shipment.price,
        '时间': shipment.date,
        '用户': msg.from.username || msg.from.first_name
    });
}

var arrival = {};
async function registerArrival(msg){
    arrival = {};
    const chatId = msg.chat.id;
    //pull a list from google sheet    
    await doc.loadInfo();
    const productSheet = doc.sheetsByTitle['货物列表'];
    const products = await productSheet.getRows({
        offset: 0,
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