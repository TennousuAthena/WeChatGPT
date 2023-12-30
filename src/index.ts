/**
 *
 *      Kakenn Gpt3 Chatbot   Powered by Wechaty and OpenAI
 *              Made with ❤️ by 嘉妍喵~
 *  _   __      _                      _____ ______ _____ _____   _____ _           _   _           _
 * | | / /     | |                    |  __ \| ___ \_   _|____ | /  __ \ |         | | | |         | |
 * | |/ /  __ _| | _____ _ __  _ __   | |  \/| |_/ / | |     / / | /  \/ |__   __ _| |_| |__   ___ | |_
 * |    \ / _` | |/ / _ \ '_ \| '_ \  | | __ |  __/  | |     \ \ | |   | '_ \ / _` | __| '_ \ / _ \| __|
 * | |\  \ (_| |   <  __/ | | | | | | | |_\ \| |     | | .___/ / | \__/\ | | | (_| | |_| |_) | (_) | |_
 * \_| \_/\__,_|_|\_\___|_| |_|_| |_|  \____/\_|     \_/ \____/   \____/_| |_|\__,_|\__|_.__/ \___/ \__|
 */

import { Contact, Message, ScanStatus, WechatyBuilder, log } from "wechaty";
import { OpenAI } from "openai";
import rTool from "./redisTool";
import { FileBox } from "file-box";
const config = require("../config.json");
const qrcode = require("qrcode-terminal");

const openai = new OpenAI({
  baseURL: config.openai.baseURL,
  organization: config.openai.org,
  apiKey: config.openai.key,
});

const bot = WechatyBuilder.build({
  name: "KakennBot",
  puppet: "wechaty-puppet-wechat4u",
});

/**
 * 生成登录二维码
 * @param qrcode_url 二维码图片链接
 * @param status
 */
function onScan(qrcode_url: string, status: ScanStatus) {
  if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
    qrcode.generate(qrcode_url, { small: true }); // show qrcode on console

    const qrcodeImageUrl = [
      "https://wechaty.js.org/qrcode/",
      encodeURIComponent(qrcode_url),
    ].join("");

    log.info(
      "StarterBot",
      "onScan: %s(%s) - %s",
      ScanStatus[status],
      status,
      qrcodeImageUrl
    );
  } else {
    log.info("StarterBot", "onScan: %s(%s)", ScanStatus[status], status);
  }
}

function onLogin(user: Contact) {
  log.info("StarterBot", "%s login", user);
}

function onLogout(user: Contact) {
  log.info("StarterBot", "%s logout", user);
}

async function getResponse(prompt: string, sender_id: string): Promise<string> {
  log.info("openAi.prompt", prompt);
  let reply: string;
  let messages: Array<any> = [
    {
      role: "system",
      content: config.chat.system_prompt.replace(
        "{name}",
        config.chat.bot_name
      ),
    },
  ];
  let message_list = await rTool.getList(sender_id);

  console.log(message_list);
  for (let i = 0; i < message_list.length; i++) {
    messages.push({
      role: message_list[i]["role"],
      content: message_list[i]["content"],
    });
  }
  console.log(messages);
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: 3072,
      temperature: 0.6,
    });
    reply = "" + response.choices[0].message?.content?.trim();
    await rTool.pushList(sender_id, { role: "assistant", content: reply });
    log.info("openAi.response", reply);
    return reply;
  } catch (error) {
    log.error("openAi.error", error);
    return config.chat.reply_on_error;
  }
}

/**
 * 移除群聊中的at部分
 * @param s string
 * @returns
 */
function removeMention(s: string): string {
  return s.replace(/@\S+\s/g, "").replace("@Kakenn", "");
}

/**
 * 消息监听
 * @param msg  Message
 */
async function onMessage(msg: Message) {
  log.info("KakennBot.gotMessage", msg.toString());
  if (msg.type() === bot.Message.Type.Text) {
    if (
      (!msg.self() && msg.room() && (await msg.mentionSelf())) ||
      !msg.room()
    ) {
      let bot_response: string;
      let sender_id: string = <string>msg.talker().id;
      let message_got: string = messageProcess(msg.text());
      if (commandProcess(msg)) {
        //命令识别
        bot_response = commandProcess(msg);
        await msg.say(bot_response);
        return;
      }
      while (
        (await rTool.countToken(sender_id)) > config.chat.queue_max_token
      ) {
        //队列长度限制
        console.log(await rTool.countToken(sender_id));
        await rTool.popList(sender_id);
      }
      await rTool.pushList(sender_id, { role: "user", content: msg.text() });
      bot_response = await getResponse(msg.text(), sender_id);
      await msg.say(bot_response);
    }
  }
}

/**
 * 命令识别
 * @param msg
 * @returns
 */
function commandProcess(msg: Message): string {
  let m: string = msg.text();
  if (m.indexOf("/") == 0) {
    log.info("KakennBot.gotCommand", m);
    if (m.indexOf("/clear") == 0) {
      rTool.deleteList(msg.talker().id);
      return "记忆已清除";
    }
    if (m.indexOf("/画") == 0) {
      commandDraw(m.replace("/画", "").trim(), msg);
      return "正在绘画，请稍等片刻";
    }
    return "未知指令";
  }
  return "";
}

async function commandDraw(prompt: string, msg: Message): Promise<void> {
  const response: OpenAI.ImagesResponse = await openai.images.generate({
    model: "dall-e-3",
    prompt: prompt,
    n: 1,
    size: "1792x1024",
  });
  await msg.say(FileBox.fromUrl(response.data[0].url));
  return;
}

/**
 * 消息处理
 * @param msg
 * @returns
 */
function messageProcess(msg: string): string {
  log.info("msgProcess.before", msg);
  msg = removeMention(msg.trim());
  log.info("msgProcess.after", msg);
  return msg;
}

bot
  .start()
  .then(() => log.info("KakennBot", "Starter Bot Started."))
  .catch((e) => log.error("KakennBot", e));

bot.on("scan", onScan);
bot.on("login", onLogin);
bot.on("logout", onLogout);
bot.on("message", onMessage);

bot.on("friendship", async (friend) => {
  log.info("KakennBot", "onFriendship");
  if (friend.type() === bot.Friendship.Type.Receive) {
    await friend.accept();
  }
});
