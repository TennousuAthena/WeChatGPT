const config = require('../config.json');
import { ChatCompletionRequestMessage } from "openai";
//Redis
import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType
let isReady: boolean
const memoryDuration: number = config.chat.memory_duration;
const redisOptions = {
  url:config.redis.url,
}


const pushList = async function(target:string, content: ChatCompletionRequestMessage){
  console.log('RedisTool.pushList', target, content);
  await (await getRedis()).rPush(target, JSON.stringify(content));
  await (await getRedis()).expire(target, memoryDuration);
  await (await getRedis()).incrBy('count_'+target, target.length)
  await (await getRedis()).expire('count_'+target, memoryDuration);
}


const deleteList = async function(target:string){
  await (await getRedis()).del(target);
  await (await getRedis()).del('count_'+target);
}

const getList = async function (target:string){
  let list = await (await getRedis()).lRange(target, 0, -1);
  for(let i = 0; i < list.length; i++){
    list[i] = JSON.parse(list[i]);
  }
  // console.log('RedisTool.getList', target, list);
  return list;
}

const ListToStr = function (list: string[]){
  let str = '';
  for(let i = 0; i < list.length; i++){
    str += list[i];
    str += '\n';
  }
  return str;
}

const countToken = async function (target:string): Promise<number>{
  return Number(await (await getRedis()).get('count_'+target));
}

const popList = async function (target:string) {
  let delToken =  String(await (await getRedis()).lPop(target));
  console.log('RedisTool.popList', target, delToken, delToken.length);
  await (await getRedis()).incrBy('count_'+target, -delToken.length)
}

async function getRedis(): Promise<RedisClientType> {
  if (!isReady) {
    redisClient = createClient({
      ...redisOptions,
    })
    redisClient.on('error', err => console.error(`Redis Error: ${err}`))
    redisClient.on('reconnecting', () => console.info('Redis reconnecting'))
    redisClient.on('ready', () => {
      isReady = true
    })
    await redisClient.connect()
  }
  return redisClient
}

getRedis().then(connection => {
  redisClient = connection
}).catch(err => {
  console.error({ err }, 'Failed to connect to Redis')
});

export default { pushList, deleteList, getList, countToken, popList, ListToStr}