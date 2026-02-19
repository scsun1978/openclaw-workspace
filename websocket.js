/**
 * WebSocket 广播模拟器
 */

const { WebSocketManager } = require('./message-service');

const wsManager = new WebSocketManager();

function broadcast(message, userId = null) {
  if (userId) {
    return wsManager.sendToUser(userId, message);
  }
  // 全局广播模拟
  for (const [uid, sockets] of wsManager.connections) {
    wsManager.sendToUser(uid, message);
  }
}

module.exports = {
  broadcast,
  wsManager
};
