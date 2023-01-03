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
//Config
const config = require('../config.json');

//Wechaty
import {
  Contact,
  Message,
  ScanStatus,
  WechatyBuilder,
  log,
} from 'wechaty'
import qrTerm from 'qrcode-terminal'

//OpenAI
import { Configuration, OpenAIApi } from "openai";
const configuration = new Configuration({
  organization: config.openai.org,
  apiKey: config.openai.key,
});
const openai = new OpenAIApi(configuration);


import rTool from './redisTool';

const bot = WechatyBuilder.build({
  name: 'KakennBot',
  puppet: 'wechaty-puppet-wechat4u',

});

bot.on('scan',    onScan);
bot.on('login',   onLogin);
bot.on('logout',  onLogout);
bot.on('message', onMessage);


/**
 * 生成登录二维码
 * @param qrcode 二维码图片链接
 * @param status 
 */
function onScan (qrcode: string, status: ScanStatus) {
  if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
    qrTerm.generate(qrcode, { small: true })  // show qrcode on console

    const qrcodeImageUrl = [
      'https://wechaty.js.org/qrcode/',
      encodeURIComponent(qrcode),
    ].join('')

    log.info('StarterBot', 'onScan: %s(%s) - %s', ScanStatus[status], status, qrcodeImageUrl)
  } else {
    log.info('StarterBot', 'onScan: %s(%s)', ScanStatus[status], status)
  }
}

function onLogin (user: Contact) {
  log.info('StarterBot', '%s login', user)
  
}

function onLogout (user: Contact) {
  log.info('StarterBot', '%s logout', user)
}

async function getResponse(prompt:string){
  log.info('openAi.prompt', prompt);
  let reply:string;
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 3072,
      temperature: 0.5,
    });
    reply = ''+response.data.choices[0].text?.trim();
    log.info('openAi.response', reply);
    return reply;
  } catch (error) {
    return config.chat.reply_on_error;
  }
}

/**
 * 移除群聊中的at部分
 * @param s string
 * @returns 
 */
function removeMention(s: string): string {
  return s.replace(/@\S+\s/g, '');
}

/**
 * 消息监听
 * @param msg  Message
 */
async function onMessage (msg: Message) {
  if (msg.type() === bot.Message.Type.Text) {
    log.info('KakennBot.gotMessage', msg.toString())
    if(!msg.self() && (msg.room() && await msg.mentionSelf()) || !msg.room()){
      let rsp:string;
      let talker:string = <string>msg.talker().id;
      let m:string = messageProcess(msg.text());
      if(commandProcess(msg)){
        rsp = commandProcess(msg);
        await msg.say(rsp);
        return;
      }
      while(await rTool.countToken(talker) > config.chat.queue_max_token){
        console.log(await rTool.countToken(talker))
        await rTool.popList(talker);
      }
      await rTool.pushList(talker, m);
      rsp = await getResponse(rTool.ListToStr(await rTool.getList(talker)));
      await msg.say(rsp)
    }
  }
}

/**
 * 命令识别
 * @param msg 
 * @returns 
 */
function commandProcess(msg: Message): string{
  let m:string = msg.text();
  if(m.indexOf('/') == 0){
    log.info('KakennBot.gotCommand', m)
    if(m.indexOf('/clear') == 0){
      rTool.deleteList(msg.talker().id);
      return '记忆已清除';
    }
    return '未知指令'
  }
  return '';
}

/**
 * 消息处理给
 * @param msg 
 * @returns
 */
function messageProcess(msg: string):string{
  log.info('msgProcess.before', msg);
  msg = removeMention(msg.trim());
  if(config.chat.punc.indexOf(msg[msg.length - 1]) == -1){
    if(config.chat.sign_of_question.indexOf(msg[msg.length - 1]) == -1){
      //不是疑问句
      msg = msg + "。"
    }else{
      msg = msg + "?"
    }
  }
  log.info('msgProcess.after', msg);
  return msg;
}


bot.start()
    .then(() => log.info('KakennBot', 'Starter Bot Started.'))
    .catch(e => log.error('KakennBot', e))