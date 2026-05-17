const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'server.js');
let content = fs.readFileSync(filePath, 'utf-8');

// Replace bot.sendMessage with bot.api.sendMessage
content = content.replace(/bot\.sendMessage/g, 'bot.api.sendMessage');

// Replace bot.sendChatAction with bot.api.sendChatAction
content = content.replace(/bot\.sendChatAction/g, 'bot.api.sendChatAction');

fs.writeFileSync(filePath, content, 'utf-8');
console.log('Fixed Grammy API calls.');
