/**
 * 私信服务 v1.0.0
 * 实现实时私信功能（WebSocket + 消息存储）
 */

const { query } = require('./database/db');

/**
 * 消息状态
 */
const MessageStatus = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read'
};

/**
 * WebSocket 连接管理器
 */
class WebSocketManager {
  constructor() {
    this.connections = new Map(); // userId -> Set of sockets
  }

  /**
   * 添加连接
   */
  addConnection(userId, socket) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(socket);
  }

  /**
   * 移除连接
   */
  removeConnection(userId, socket) {
    const userSockets = this.connections.get(userId);
    if (userSockets) {
      userSockets.delete(socket);
      if (userSockets.size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  /**
   * 发送消息给用户
   */
  sendToUser(userId, message) {
    const userSockets = this.connections.get(userId);
    if (userSockets && userSockets.size > 0) {
      const messageStr = JSON.stringify(message);
      userSockets.forEach(socket => {
        try {
          socket.send(messageStr);
        } catch (e) {
          // 连接可能已关闭
        }
      });
      return true;
    }
    return false;
  }

  /**
   * 检查用户是否在线
   */
  isOnline(userId) {
    return this.connections.has(userId);
  }

  /**
   * 获取在线用户数
   */
  getOnlineCount() {
    return this.connections.size;
  }
}

/**
 * 私信服务类
 */
class MessageService {
  constructor(wsManager = null) {
    this.wsManager = wsManager || new WebSocketManager();
    this.unreadCache = new Map(); // userId -> unreadCount
  }

  /**
   * 发送私信
   */
  async sendMessage(fromUserId, toUserId, content) {
    if (!content || content.trim().length === 0) {
      throw new Error('消息内容不能为空');
    }

    if (content.length > 5000) {
      throw new Error('消息长度不能超过5000字符');
    }

    // 存储消息
    const result = await query(
      `INSERT INTO messages (from_user_id, to_user_id, content, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, created_at`,
      [fromUserId, toUserId, content.trim(), MessageStatus.SENT]
    );

    const message = {
      id: result.rows[0].id,
      fromUserId,
      toUserId,
      content: content.trim(),
      status: MessageStatus.SENT,
      createdAt: result.rows[0].created_at
    };

    // 尝试实时推送
    const delivered = this.wsManager.sendToUser(toUserId, {
      type: 'message',
      data: message
    });

    // 更新消息状态
    if (delivered) {
      await query(
        `UPDATE messages SET status = $1 WHERE id = $2`,
        [MessageStatus.DELIVERED, message.id]
      );
      message.status = MessageStatus.DELIVERED;
    }

    // 更新未读计数
    await this.incrementUnreadCount(toUserId);

    return message;
  }

  /**
   * 获取聊天历史
   */
  async getConversation(userId, otherUserId, page = 1, limit = 50) {
    const offset = (page - 1) * limit;

    const result = await query(
      `SELECT id, from_user_id, to_user_id, content, status, created_at
       FROM messages
       WHERE (from_user_id = $1 AND to_user_id = $2)
          OR (from_user_id = $2 AND to_user_id = $1)
       ORDER BY created_at DESC
       LIMIT $3 OFFSET $4`,
      [userId, otherUserId, limit, offset]
    );

    return result.rows.reverse(); // 返回正序
  }

  /**
   * 获取会话列表
   */
  async getConversations(userId) {
    const result = await query(
      `SELECT DISTINCT ON (other_user_id)
             other_user_id, username, avatar, last_message, last_time, unread
       FROM (
         SELECT 
           CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END as other_user_id,
           content as last_message,
           created_at as last_time,
           CASE WHEN to_user_id = $1 AND status = 'sent' THEN 1 ELSE 0 END as unread
         FROM messages
         WHERE from_user_id = $1 OR to_user_id = $1
       ) m
       JOIN users u ON m.other_user_id = u.id
       ORDER BY other_user_id, last_time DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * 标记消息已读
   */
  async markAsRead(userId, fromUserId) {
    await query(
      `UPDATE messages 
       SET status = $1 
       WHERE to_user_id = $2 AND from_user_id = $3 AND status != $1`,
      [MessageStatus.READ, userId, fromUserId]
    );

    // 重置未读计数
    const cacheKey = `${userId}:${fromUserId}`;
    this.unreadCache.delete(cacheKey);

    return { success: true };
  }

  /**
   * 获取未读计数
   */
  async getUnreadCount(userId) {
    const result = await query(
      `SELECT COUNT(*) as count FROM messages 
       WHERE to_user_id = $1 AND status = 'sent'`,
      [userId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * 增加未读计数
   */
  async incrementUnreadCount(userId) {
    // 简单实现：直接在缓存中增加
    const current = this.unreadCache.get(userId) || 0;
    this.unreadCache.set(userId, current + 1);
  }

  /**
   * 删除消息（软删除）
   */
  async deleteMessage(userId, messageId) {
    const result = await query(
      `UPDATE messages 
       SET deleted_at = NOW() 
       WHERE id = $1 AND (from_user_id = $2 OR to_user_id = $2)
       RETURNING *`,
      [messageId, userId]
    );

    return {
      success: result.rowCount > 0,
      deleted: result.rowCount > 0
    };
  }

  /**
   * 获取 WebSocket 管理器
   */
  getWebSocketManager() {
    return this.wsManager;
  }

  /**
   * 模拟 WebSocket 连接（用于测试）
   */
  mockConnect(userId, socket = null) {
    const mockSocket = socket || {
      send: jest.fn(),
      readyState: 1
    };
    this.wsManager.addConnection(userId, mockSocket);
    return mockSocket;
  }

  /**
   * 模拟断开连接
   */
  mockDisconnect(userId, socket = null) {
    if (socket) {
      this.wsManager.removeConnection(userId, socket);
    } else {
      this.wsManager.connections.delete(userId);
    }
  }
}

module.exports = {
  MessageService,
  WebSocketManager,
  MessageStatus
};
