# 添加价格状态端点
content = open('/home/scsun/stock-simgame-live/src/routes/api.js').read()

if 'price-status' not in content:
    insert_code = """
// ========== 价格源状态 ==========
router.get('/market/price-status', (req, res) => {
  const priceUpdater = require('../services/price-updater');
  res.json({ success: true, data: priceUpdater.getStatus() });
});

"""
    content = content.replace("router.use('/news', news);", insert_code + "router.use('/news', news);")
    open('/home/scsun/stock-simgame-live/src/routes/api.js', 'w').write(content)
    print('Price status endpoint added')
else:
    print('Endpoint already exists')
