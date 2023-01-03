const config = require('../config.json');

//Redis
import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType
let isReady: boolean
const memoryDuration: number = config.chat.memory_duration;
const queueMaxToken: number = config.chat.queue_max_token;
const redisOptions = {
  url:config.redis.url,
}


const pushList = async function(target:string, content: string){
  await (await getRedis()).rPush(target, content);
  await (await getRedis()).expire(target, memoryDuration);
  await (await getRedis()).incrBy('count_'+target, target.length)
}


const deleteList = async function(target:string){
  await (await getRedis()).del(target);
  await (await getRedis()).del('count_'+target);
}

const getList = async function (target:string){
  return await (await getRedis()).lRange(target, 0, -1);
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