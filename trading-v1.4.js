const { query } = require('../database/db');

const marketPrices = {
  'META': { price: 500.00 }, 'NVDA': { price: 880.00 }, 'NFLX': { price: 620.00 },
  'AAPL': { price: 150.00 }, 'GOOGL': { price: 2800.00 }, 'TSLA': { price: 700.00 },
  'MSFT': { price: 350.00 }, 'AMZN': { price: 3300.00 }
};

async function getCurrentPrice(symbol) {
  const basePrice = marketPrices[symbol]?.price || 100.00;
  const change = basePrice * (Math.random() - 0.5) * 0.02;
  return parseFloat((parseFloat(basePrice) + change).toFixed(2));
}

function updateMarketPrice(symbol, newPrice) {
  if (!marketPrices[symbol]) marketPrices[symbol] = { price: newPrice };
  else marketPrices[symbol].price = newPrice;
}

async function createOrder(userId, { symbol, side, type, quantity, price }) {
  const currentPrice = await getCurrentPrice(symbol);
  const orderPrice = type === 'MARKET' ? currentPrice : price;
  const totalCost = orderPrice * quantity;

  if (side === 'BUY') {
    await query('UPDATE users SET balance = balance - $1 WHERE id = $2', [totalCost, userId]);
    await query(
      'INSERT INTO holdings (user_id, symbol, quantity, avg_price) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, symbol) DO UPDATE SET quantity = holdings.quantity + $3, avg_price = (holdings.avg_price * holdings.quantity + $4 * $3) / (holdings.quantity + $3)',
      [userId, symbol, quantity, orderPrice]
    );
  } else {
    await query('UPDATE holdings SET quantity = quantity - $1 WHERE user_id = $2 AND symbol = $3', [quantity, userId, symbol]);
    await query('UPDATE users SET balance = balance + $1 WHERE id = $2', [totalCost, userId]);
  }

  const result = await query(
    'INSERT INTO orders (user_id, symbol, side, type, quantity, price, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [userId, symbol, side, type, quantity, orderPrice, 'PENDING']
  );
  const orderId = result.rows[0].id;
  const updatedResult = await query(
    "UPDATE orders SET status = 'FILLED', filled_quantity = $1, filled_price = $2, filled_at = NOW() WHERE id = $3 RETURNING *",
    [quantity, orderPrice, orderId]
  );

  const userRes = await query('SELECT balance FROM users WHERE id = $1', [userId]);
  const holdingsRes = await query('SELECT symbol, quantity FROM holdings WHERE user_id = $1 AND quantity > 0', [userId]);
  let hVal = 0;
  for (const h of holdingsRes.rows) {
    hVal += (marketPrices[h.symbol]?.price || 100) * h.quantity;
  }
  await query('UPDATE users SET total_asset = $1 WHERE id = $2', [parseFloat(userRes.rows[0].balance) + hVal, userId]);

  try { require('./websocket').broadcast({ type: 'ORDER_FILLED', data: { symbol } }, userId); } catch(e) {}
  try { require('./achievement').checkAfterTrade(userId); } catch(e) {}

  return updatedResult.rows[0];
}

async function getOrders(userId) {
  return (await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId])).rows;
}

async function getPositions(userId) {
  return (await query('SELECT * FROM holdings WHERE user_id = $1 AND quantity > 0', [userId])).rows;
}

async function getAccount(userId) {
  return (await query('SELECT balance, total_asset, username FROM users WHERE id = $1', [userId])).rows[0];
}

function getOrderBook(symbol) {
  return { buys: [], sells: [] };
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
