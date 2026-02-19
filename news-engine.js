/**
 * 新闻引擎服务 - 市场事件驱动价格波动
 */

const { broadcast } = require('./websocket');

// 新闻事件库
const NEWS_EVENTS = [
  // 科技公司正面新闻
  { symbol: 'AAPL', type: 'positive', headline: '苹果发布革命性新品，市场反应热烈', impact: 0.03 },
  { symbol: 'AAPL', type: 'positive', headline: 'iPhone 销量创历史新高', impact: 0.025 },
  { symbol: 'AAPL', type: 'positive', headline: '苹果服务业务收入大幅增长', impact: 0.02 },
  { symbol: 'GOOGL', type: 'positive', headline: '谷歌 AI 技术取得重大突破', impact: 0.035 },
  { symbol: 'GOOGL', type: 'positive', headline: '谷歌云业务市场份额提升', impact: 0.02 },
  { symbol: 'TSLA', type: 'positive', headline: '特斯拉季度交付量超预期', impact: 0.04 },
  { symbol: 'TSLA', type: 'positive', headline: '特斯拉新工厂正式投产', impact: 0.03 },
  { symbol: 'MSFT', type: 'positive', headline: '微软 Azure 云服务增长强劲', impact: 0.025 },
  { symbol: 'MSFT', type: 'positive', headline: '微软企业合同大单签订', impact: 0.02 },
  { symbol: 'AMZN', type: 'positive', headline: '亚马逊 Prime 会员突破新纪录', impact: 0.03 },
  { symbol: 'AMZN', type: 'positive', headline: '亚马逊 AWS 营收超预期', impact: 0.025 },
  
  // 科技公司负面新闻
  { symbol: 'AAPL', type: 'negative', headline: '苹果供应链面临中断风险', impact: -0.025 },
  { symbol: 'AAPL', type: 'negative', headline: 'App Store 面临反垄断调查', impact: -0.02 },
  { symbol: 'GOOGL', type: 'negative', headline: '谷歌广告收入增长放缓', impact: -0.03 },
  { symbol: 'GOOGL', type: 'negative', headline: '欧盟对谷歌开出巨额罚单', impact: -0.035 },
  { symbol: 'TSLA', type: 'negative', headline: '特斯拉车辆召回引发担忧', impact: -0.03 },
  { symbol: 'TSLA', type: 'negative', headline: '马斯克言论引发股价波动', impact: -0.04 },
  { symbol: 'MSFT', type: 'negative', headline: '微软面临云计算竞争压力', impact: -0.02 },
  { symbol: 'AMZN', type: 'negative', headline: '亚马逊物流成本上升', impact: -0.025 },
  
  // 全球市场新闻
  { symbol: 'ALL', type: 'positive', headline: '美联储暗示暂停加息，股市普涨', impact: 0.02 },
  { symbol: 'ALL', type: 'positive', headline: '中美贸易谈判取得积极进展', impact: 0.015 },
  { symbol: 'ALL', type: 'positive', headline: '全球经济复苏迹象明显', impact: 0.025 },
  { symbol: 'ALL', type: 'negative', headline: '通胀担忧加剧，市场情绪谨慎', impact: -0.02 },
  { symbol: 'ALL', type: 'negative', headline: '地缘政治紧张，投资者避险', impact: -0.025 },
  { symbol: 'ALL', type: 'negative', headline: '美联储意外加息，科技股承压', impact: -0.035 },
  
  // 行业新闻
  { symbol: 'ALL', type: 'neutral', headline: '科技行业并购活动活跃', impact: 0 },
  { symbol: 'ALL', type: 'neutral', headline: 'AI 投资持续升温', impact: 0.01 },
  { symbol: 'ALL', type: 'neutral', headline: '云计算市场竞争加剧', impact: -0.005 }
];

let newsHistory = [];
let isRunning = false;

// 获取市场价格（从 trading 服务）
let getMarketPrices = null;
let updateMarketPrice = null;

function setPriceFunctions(getPrices, updatePrice) {
  getMarketPrices = getPrices;
  updateMarketPrice = updatePrice;
}

// 生成新闻事件
function generateNews() {
  const event = NEWS_EVENTS[Math.floor(Math.random() * NEWS_EVENTS.length)];
  return {
    ...event,
    timestamp: Date.now(),
    id: 'news_' + Date.now()
  };
}

// 发布新闻并影响价格
async function publishNews() {
  if (!isRunning || !getMarketPrices || !updateMarketPrice) return;
  
  const news = generateNews();
  const prices = getMarketPrices();
  
  newsHistory.unshift(news);
  if (newsHistory.length > 50) newsHistory.pop();
  
  // 应用价格影响
  const symbols = news.symbol === 'ALL' ? Object.keys(prices) : [news.symbol];
  
  for (const symbol of symbols) {
    const currentPrice = prices[symbol];
    const change = currentPrice * news.impact;
    const newPrice = Math.max(1, currentPrice + change);
    updateMarketPrice(symbol, newPrice);
  }
  
  // 广播新闻
  broadcast({
    type: 'MARKET_NEWS',
    data: news
  });
  
  console.log('[NewsEngine] Published: ' + news.headline + ' (' + (news.impact > 0 ? '+' : '') + (news.impact * 100).toFixed(1) + '%)');
  
  return news;
}

// 启动新闻引擎
function start() {
  if (isRunning) return;
  isRunning = true;
  
  // 每 30-60 秒发布一条新闻
  function scheduleNext() {
    const delay = 30000 + Math.random() * 30000;
    setTimeout(() => {
      publishNews();
      scheduleNext();
    }, delay);
  }
  
  // 初始延迟 10 秒
  setTimeout(() => {
    publishNews();
    scheduleNext();
  }, 10000);
  
  console.log('[NewsEngine] News engine started');
}

// 获取历史新闻
function getHistory(limit = 10) {
  return newsHistory.slice(0, limit);
}

module.exports = { start, setPriceFunctions, getHistory, publishNews };
