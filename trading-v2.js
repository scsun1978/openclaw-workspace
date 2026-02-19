/**
 * 交易服务 v2 - 完整撮合引擎
 */
const { query } = require('../database/db');
const { broadcast } = require('./websocket');

// 初始价格
const marketPrices = {
  'META': { price: 500.00 },
  'NVDA': { price: 880.00 },
  'NFLX': { price: 620.00 },
  'AAPL': { price: 150.00 },
  'GOOGL': { price: 2800.00 },
  'TSLA': { price: 700.00 },
  'MSFT': { price: 350.00 },
  'AMZN': { price: 3300.00 }
};

// 订单簿
const orderBooks = {};

function initOrderBook(symbol) {
  if (!orderBooks[symbol]) {
    orderBooks[symbol] = { buys: [], sells: [] };
  }
}

async function getCurrentPrice(symbol) {
  const basePrice = marketPrices[symbol]?.price || 100.00;
  const change = basePrice * (Math.random() - 0.5) * 0.02;
  return parseFloat((parseFloat(basePrice) + change).toFixed(2));
}

function updateMarketPrice(symbol, newPrice) {
  if (!marketPrices[symbol]) {
    marketPrices[symbol] = { price: newPrice };
  } else {
    marketPrices[symbol].price = newPrice;
  }
}

// 创建订单
async function createOrder(userId, { symbol, side, type, quantity, price }) {
  // 参数验证
  if (!symbol || !side || !type || !quantity) {
    throw new Error('Missing required fields');
  }
  if (!['BUY', 'SELL'].includes(side)) throw new Error('Invalid side');
  if (!['MARKET', 'LIMIT'].includes(type)) throw new Error('Invalid type');
  if (quantity <= 0) throw new Error('Invalid quantity');

  const currentPrice = await getCurrentPrice(symbol);
  const orderPrice = type === 'MARKET' ? currentPrice : price;

  // 检查余额/持仓
  if (side === 'BUY') {
    const user = await query('SELECT balance FROM users WHERE id = $1', [userId]);
    const balance = parseFloat(user.rows[0]?.balance || 0);
    const required = orderPrice * quantity;
    if (balance < required) {
      throw new Error('Insufficient balance. Need: $' + required.toFixed(2));
    }
  } else {
    const holding = await query(
      'SELECT quantity FROM holdings WHERE user_id = $1 AND symbol = $2',
      [userId, symbol]
    );
    const heldQty = holding.rows[0]?.quantity || 0;
    if (heldQty < quantity) {
      throw new Error('Insufficient holdings. Have: ' + heldQty);
    }
  }

  // 创建订单
  const result = await query(
    `INSERT INTO orders (user_id, symbol, side, type, quantity, price, status, filled_quantity)
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', 0) RETURNING *`,
    [userId, symbol, side, type, quantity, orderPrice]
  );
  const order = result.rows[0];

  // 市价单立即撮合
  if (type === 'MARKET') {
    await executeMarketOrder(order, currentPrice);
  } else {
    // 限价单加入订单簿
    initOrderBook(symbol);
    const book = orderBooks[symbol];
    if (side === 'BUY') {
      book.buys.push(order);
      book.buys.sort((a, b) => b.price - a.price); // 价格降序
    } else {
      book.sells.push(order);
      book.sells.sort((a, b) => a.price - b.price); // 价格升序
    }
    
    // 尝试撮合
    await matchOrders(symbol);
  }

  // 检查成就
  const achievement = require('./achievement');
  achievement.checkAfterTrade(userId).catch(() => {});

  return order;
}

// 执行市价单
async function executeMarketOrder(order, price) {
  const totalCost = price * order.quantity;
  
  if (order.side === 'BUY') {
    // 扣除余额
    await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [totalCost, order.user_id]);
    // 增加持仓
    await query(
      `INSERT INTO holdings (user_id, symbol, quantity, avg_price)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, symbol)
       DO UPDATE SET 
         quantity = holdings.quantity + $3,
         avg_price = (holdings.avg_price * holdings.quantity + $4 * $3) / (holdings.quantity + $3),
         updated_at = NOW()`,
      [order.user_id, order.symbol, order.quantity, price]
    );
  } else {
    // 扣除持仓
    await query(
      'UPDATE holdings SET quantity = quantity - $1, updated_at = NOW() WHERE user_id = $2 AND symbol = $3',
      [order.quantity, order.user_id, order.symbol]
    );
    // 增加余额
    await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [totalCost, order.user_id]);
  }

  // 更新订单状态
  await query(
    `UPDATE orders SET status = 'FILLED', filled_quantity = $1, filled_price = $2, filled_at = NOW()
     WHERE id = $3`,
    [order.quantity, price, order.id]
  );

  // 更新总资产
  await updateTotalAsset(order.user_id);

  // 广播成交
  broadcast({
    type: 'ORDER_FILLED',
    data: { orderId: order.id, symbol: order.symbol, side: order.side, quantity: order.quantity, price }
  }, order.user_id);
}

// 撮合订单
async function matchOrders(symbol) {
  initOrderBook(symbol);
  const book = orderBooks[symbol];
  
  while (book.buys.length > 0 && book.sells.length > 0) {
    const buyOrder = book.buys[0];
    const sellOrder = book.sells[0];
    
    // 检查价格是否匹配
    if (buyOrder.price < sellOrder.price) break;
    
    const matchPrice = sellOrder.price;
    const matchQty = Math.min(
      buyOrder.quantity - buyOrder.filled_quantity,
      sellOrder.quantity - sellOrder.filled_quantity
    );
    
    // 执行撮合
    await executeMatch(buyOrder, sellOrder, matchPrice, matchQty);
    
    // 移除已完成的订单
    if (buyOrder.filled_quantity >= buyOrder.quantity) book.buys.shift();
    if (sellOrder.filled_quantity >= sellOrder.quantity) book.sells.shift();
  }
}

// 执行单笔撮合
async function executeMatch(buyOrder, sellOrder, price, quantity) {
  // 买方：扣余额，加持仓
  const cost = price * quantity;
  await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [cost, buyOrder.user_id]);
  await query(
    `INSERT INTO holdings (user_id, symbol, quantity, avg_price)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, symbol)
     DO UPDATE SET 
       quantity = holdings.quantity + $3,
       avg_price = (holdings.avg_price * holdings.quantity + $4 * $3) / (holdings.quantity + $3),
       updated_at = NOW()`,
    [buyOrder.user_id, buyOrder.symbol, quantity, price]
  );
  
  // 卖方：扣持仓，加余额
  await query(
    'UPDATE holdings SET quantity = quantity - $1, updated_at = NOW() WHERE user_id = $2 AND symbol = $3',
    [quantity, sellOrder.user_id, sellOrder.symbol]
  );
  await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [cost, sellOrder.user_id]);
  
  // 更新订单
  await query(
    'UPDATE orders SET filled_quantity = filled_quantity + $1, filled_price = $2 WHERE id = $3',
    [quantity, price, buyOrder.id]
  );
  await query(
    'UPDATE orders SET filled_quantity = filled_quantity + $1, filled_price = $2 WHERE id = $3',
    [quantity, price, sellOrder.id]
  );
  
  // 更新内存状态
  buyOrder.filled_quantity = (buyOrder.filled_quantity || 0) + quantity;
  sellOrder.filled_quantity = (sellOrder.filled_quantity || 0) + quantity;
  
  // 检查完成
  if (buyOrder.filled_quantity >= buyOrder.quantity) {
    await query("UPDATE orders SET status = 'FILLED', filled_at = NOW() WHERE id = $1", [buyOrder.id]);
  }
  if (sellOrder.filled_quantity >= sellOrder.quantity) {
    await query("UPDATE orders SET status = 'FILLED', filled_at = NOW() WHERE id = $1", [sellOrder.id]);
  }
  
  // 更新总资产
  await updateTotalAsset(buyOrder.user_id);
  await updateTotalAsset(sellOrder.user_id);
  
  // 广播
  broadcast({ type: 'ORDER_FILLED', data: { orderId: buyOrder.id, symbol: buyOrder.symbol } }, buyOrder.user_id);
  broadcast({ type: 'ORDER_FILLED', data: { orderId: sellOrder.id, symbol: sellOrder.symbol } }, sellOrder.user_id);
}

// 更新总资产
async function updateTotalAsset(userId) {
  const user = await query('SELECT balance FROM users WHERE id = $1', [userId]);
  const balance = parseFloat(user.rows[0]?.balance || 0);
  
  const holdings = await query('SELECT symbol, quantity FROM holdings WHERE user_id = $1 AND quantity > 0', [userId]);
  let holdingsValue = 0;
  for (const h of holdings.rows) {
    const price = await getCurrentPrice(h.symbol);
    holdingsValue += price * h.quantity;
  }
  
  const totalAsset = balance + holdingsValue;
  await query('UPDATE users SET total_asset = $1 WHERE id = $2', [totalAsset, userId]);
}

async function getOrders(userId) {
  const res = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]);
  return res.rows;
}

async function getPositions(userId) {
  const res = await query('SELECT * FROM holdings WHERE user_id = $1 AND quantity > 0', [userId]);
  return res.rows;
}

async function getAccount(userId) {
  const res = await query('SELECT balance, total_asset, username FROM users WHERE id = $1', [userId]);
  return res.rows[0];
}

function getOrderBook(symbol) {
  initOrderBook(symbol);
  return orderBooks[symbol];
}

module.exports = {
  updateMarketPrice,
  createOrder,
  getOrders,
  getPositions,
  getAccount,
  getCurrentPrice,
  getOrderBook,
  marketPrices
};
