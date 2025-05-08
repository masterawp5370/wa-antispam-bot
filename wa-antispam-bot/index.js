const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const moment = require('moment');

const client = new Client({
    authStrategy: new LocalAuth()
});

let userMessages = {};

// 显示二维码为图像链接
client.on('qr', qr => {
    qrcode.toDataURL(qr, (err, url) => {
        if (err) {
            console.error('生成二维码失败:', err);
        } else {
            console.log('👉 请复制以下链接到浏览器扫码登录：');
            console.log(url);
        }
    });
});

client.on('ready', () => {
    console.log('✅ WhatsApp 已连接');
});

client.on('message', async message => {
    const chat = await message.getChat();

    // 只处理群组消息
    if (!chat.isGroup) return;

    const userId = message.author;
    const currentTime = moment();

    if (!userMessages[userId]) {
        userMessages[userId] = [];
    }

    userMessages[userId].push({ time: currentTime, msgId: message.id._serialized });

    // 清除30秒外的消息
    userMessages[userId] = userMessages[userId].filter(entry => currentTime.diff(entry.time, 'seconds') <= 30);

    // 检测刷屏
    if (userMessages[userId].length > 3) {
        console.log(`⚠️ 检测到刷屏：${userId}`);

        try {
            await chat.setMessagesAdminsOnly(true);
            console.log('🚫 群组已设为仅管理员可发言');
        } catch (err) {
            console.error('❌ 禁言失败:', err);
        }

        // 删除该用户的消息
        const delay = 1000;
        for (const entry of userMessages[userId]) {
            try {
                const msgs = await chat.fetchMessages({ limit: 100 });
                const targetMsg = msgs.find(m => m.id._serialized === entry.msgId);
                if (targetMsg) {
                    await targetMsg.delete(true);
                    console.log(`🗑 已删除消息 ${entry.msgId}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (err) {
                console.error('❌ 删除消息失败:', err);
            }
        }

        userMessages[userId] = [];

        // 延迟发送提醒
        setTimeout(async () => {
            const groupId = '120363344660385759@g.us';  // 替换为你的群组ID
            try {
                const groupChat = await client.getChatById(groupId);
                if (groupChat) {
                    await groupChat.sendMessage('P1群。');
                    console.log('📢 提醒已发送');
                } else {
                    console.log('未找到指定群组');
                }
            } catch (err) {
                console.error('❌ 获取群组或发送提醒失败:', err);
            }
        }, 5000);
    }
});

client.initialize();
