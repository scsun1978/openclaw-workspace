/**
 * 做市商机器人服务 - 提供流动性
 */

const { query } = require('../database/db');
const trading = require('./trading');

// 机器人配置
const BOTS = [
  { name: 'AlphaBot', strategy: 'contrarian', riskLevel: 0.7 },
  { name: 'BetaBot', strategy: 'momentum', riskLevel: 0.5 },
  { name: 'GammaBot', strategy: 'random', riskLevel: 0.3 },
  { name: 'DeltaBot', strategy: 'spread', riskLevel: 0.6 },
  { name: 'EpsilonBot', strategy: 'contrarian', riskLevel: 0.4 }
];

let botUsers = [];
let isRunning = false;

// 初始化机器人账户
async function initBots() {
  console.log('[MarketMaker] Initializing bot accounts...');
  
  for (const bot of BOTS) {
    const email = bot.name.toLowerCase() + '@bot.simgame';
    
    // 检查是否已存在
    const existing = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existing.rows.length > 0) {
      botUsers.push({ ...bot, userId: existing.rows[0].id });
      continue;
    }
    
    // 创建机器人账户
    const result = await query(
      'INSERT INTO users (username, email, password_hash, balance, total_asset) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [bot.name, email, 'bot_no_login', 500000, 500000]
    );
    
    botUsers.push({ ...bot, userId: result.rows[0].id });
    console.log('[MarketMaker] Created bot: ' + bot.name);
  }
  
  console.log('[MarketMaker] ' + botUsers.length + ' bots initialized');
}

// 生成随机订单
async function generateOrder(bot) {
  const symbols = Object.keys(trading.marketPrices);
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];
  const currentPrice = await trading.getCurrentPrice(symbol);
  
  // 根据策略决定买卖
  let side;
  const rand = Math.random();
  
  switch (bot.strategy) {
    case 'contrarian':
      side = rand > 0.5 ? 'SELL' : 'BUY';
      break;
    case 'momentum':
      side = rand > 0.5 ? 'BUY' : 'SELL';
      break;
    case 'spread':
      side = rand > 0.5 ? 'BUY' : 'SELL';
      break;
    default:
      side = Math.random() > 0.5 ? 'BUY' : 'SELL';
  }
  
  // 价格在当前价格附近浮动
  const priceOffset = (Math.random() - 0.5) * currentPrice * 0.02;
  const price = Math.round((currentPrice + priceOffset) * 100) / 100;
  
  // 数量
  const quantity = Math.floor(Math.random() * 50) + 10;
  
  return {
    userId: bot.userId,
    symbol,
    side,
    type: 'LIMIT',
    quantity,
    price
  };
}

// 执行交易周期
async function runTradingCycle() {
  if (!isRunning) return;
  
  for (const bot of botUsers) {
    if (Math.random() < 0.3) {
      try {
        const order = await generateOrder(bot);
        await trading.createOrder(order.userId, order);
      } catch (err) {
        // 忽略错误
      }
    }
  }
}

// 启动做市商
function start() {
  if (isRunning) return;
  isRunning = true;
  
  initBots().then(() => {
    setInterval(runTradingCycle, 5000);
    console.log('[MarketMaker] Bot trading started');
  });
}

module.exports = { start, initBots };
