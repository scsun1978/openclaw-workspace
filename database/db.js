/**
 * 数据库连接模块 - Mock实现用于测试
 */

const mockDb = {
  query: async (sql, params) => {
    console.log('[MOCK DB] Query:', sql.substring(0, 50) + '...');
    console.log('[MOCK DB] Params:', params);
    return { rows: [] };
  }
};

module.exports = {
  query: mockDb.query,
  connect: async () => {},
  end: async () => {}
};
