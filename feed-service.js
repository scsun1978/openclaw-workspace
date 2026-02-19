/**
 * 动态墙服务 v1.0.0
 * 实现用户动态聚合与推送
 */

const { query } = require('./database/db');

/**
 * 动态类型
 */
const FeedType = {
  TRADE: 'trade',           // 交易动态
  ACHIEVEMENT: 'achievement', // 成就达成
  FOLLOW: 'follow',         // 关注动态
  SYSTEM: 'system'          // 系统公告
};

/**
 * 可见性设置
 */
const Visibility = {
  PUBLIC: 'public',      // 所有人可见
  FRIENDS: 'friends',    // 仅好友可见
  PRIVATE: 'private'     // 仅自己可见
};

/**
 * 动态墙服务类
 */
class FeedService {
  constructor(cache = null) {
    this.cache = cache || new Map();
    this.cacheTTL = 60000; // 1分钟缓存
  }

  /**
   * 发布动态
   */
  async publishFeed(userId, options) {
    const {
      type,
      content,
      visibility = Visibility.PUBLIC,
      metadata = {}
    } = options;

    if (!content || content.trim().length === 0) {
      throw new Error('动态内容不能为空');
    }

    const result = await query(
      `INSERT INTO feeds (user_id, type, content, visibility, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING id, created_at`,
      [userId, type, content.trim(), visibility, JSON.stringify(metadata)]
    );

    const feed = {
      id: result.rows[0].id,
      userId,
      type,
      content: content.trim(),
      visibility,
      metadata,
      createdAt: result.rows[0].created_at
    };

    // 清除相关缓存
    this.clearUserFeedCache(userId);

    return feed;
  }

  /**
   * 发布交易动态
   */
  async publishTradeFeed(userId, tradeInfo) {
    const { symbol, action, quantity, price } = tradeInfo;
    
    const content = action === 'buy' 
      ? `买入了 ${quantity} 股 ${symbol}` 
      : `卖出了 ${quantity} 股 ${symbol}`;

    return await this.publishFeed(userId, {
      type: FeedType.TRADE,
      content,
      visibility: Visibility.PUBLIC,
      metadata: { symbol, action, quantity, price }
    });
  }

  /**
   * 发布成就动态
   */
  async publishAchievementFeed(userId, achievement) {
    const content = `🏆 达成成就: ${achievement.name}`;
    
    return await this.publishFeed(userId, {
      type: FeedType.ACHIEVEMENT,
      content,
      visibility: Visibility.PUBLIC,
      metadata: { achievementId: achievement.id, achievementName: achievement.name }
    });
  }

  /**
   * 获取用户动态（自己的）
   */
  async getUserFeeds(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    const result = await query(
      `SELECT f.id, f.user_id, f.type, f.content, f.visibility, f.metadata, f.created_at,
              u.username, u.avatar
       FROM feeds f
       JOIN users u ON f.user_id = u.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * 获取好友动态聚合（Feed流）
   */
  async getFriendFeed(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    // 获取关注用户的动态 + 自己的动态
    const result = await query(
      `SELECT f.id, f.user_id, f.type, f.content, f.visibility, f.metadata, f.created_at,
              u.username, u.avatar
       FROM feeds f
       JOIN users u ON f.user_id = u.id
       WHERE (f.user_id IN (SELECT target_user_id FROM user_follows WHERE user_id = $1)
              OR f.user_id = $1)
         AND f.visibility IN ('public', 'friends')
       ORDER BY f.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * 获取全服动态（公共 Feed）
   */
  async getPublicFeed(page = 1, limit = 20) {
    const cacheKey = `public:${page}:${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const offset = (page - 1) * limit;
    
    const result = await query(
      `SELECT f.id, f.user_id, f.type, f.content, f.visibility, f.metadata, f.created_at,
              u.username, u.avatar
       FROM feeds f
       JOIN users u ON f.user_id = u.id
       WHERE f.visibility = 'public'
       ORDER BY f.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    this.cache.set(cacheKey, result.rows);
    setTimeout(() => this.cache.delete(cacheKey), this.cacheTTL);

    return result.rows;
  }

  /**
   * 检查动态可见性
   */
  async checkVisibility(feedId, viewerId) {
    const result = await query(
      `SELECT f.user_id, f.visibility
       FROM feeds f
       WHERE f.id = $1`,
      [feedId]
    );

    if (result.rowCount === 0) {
      return { visible: false, reason: '动态不存在' };
    }

    const { user_id, visibility } = result.rows[0];

    // 公开动态
    if (visibility === Visibility.PUBLIC) {
      return { visible: true };
    }

    // 私有动态
    if (visibility === Visibility.PRIVATE) {
      return { visible: user_id === viewerId };
    }

    // 好友可见
    if (visibility === Visibility.FRIENDS) {
      if (user_id === viewerId) {
        return { visible: true };
      }

      // 检查是否互关
      const followCheck = await query(
        `SELECT COUNT(*) as count FROM user_follows
         WHERE (user_id = $1 AND target_user_id = $2)
            OR (user_id = $2 AND target_user_id = $1)`,
        [user_id, viewerId]
      );

      const isMutual = parseInt(followCheck.rows[0].count) === 2;
      return { visible: isMutual };
    }

    return { visible: false };
  }

  /**
   * 删除动态
   */
  async deleteFeed(userId, feedId) {
    const result = await query(
      `DELETE FROM feeds 
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [feedId, userId]
    );

    if (result.rowCount > 0) {
      this.clearUserFeedCache(userId);
    }

    return {
      success: result.rowCount > 0,
      deleted: result.rowCount > 0
    };
  }

  /**
   * 点赞动态
   */
  async likeFeed(userId, feedId) {
    try {
      await query(
        `INSERT INTO feed_likes (feed_id, user_id, created_at)
         VALUES ($1, $2, NOW())`,
        [feedId, userId]
      );

      await query(
        `UPDATE feeds SET like_count = like_count + 1 WHERE id = $1`,
        [feedId]
      );

      return { success: true, liked: true };
    } catch (error) {
      if (error.code === '23505') { // 唯一约束冲突
        return { success: false, liked: false, reason: '已点赞' };
      }
      throw error;
    }
  }

  /**
   * 取消点赞
   */
  async unlikeFeed(userId, feedId) {
    const result = await query(
      `DELETE FROM feed_likes 
       WHERE feed_id = $1 AND user_id = $2
       RETURNING *`,
      [feedId, userId]
    );

    if (result.rowCount > 0) {
      await query(
        `UPDATE feeds SET like_count = GREATEST(0, like_count - 1) WHERE id = $1`,
        [feedId]
      );
    }

    return { success: result.rowCount > 0 };
  }

  /**
   * 清除用户动态缓存
   */
  clearUserFeedCache(userId) {
    for (const key of this.cache.keys()) {
      if (key.includes(`user:${userId}`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取动态统计
   */
  async getFeedStats(userId) {
    const result = await query(
      `SELECT 
         COUNT(*) as total,
         COUNT(CASE WHEN type = 'trade' THEN 1 END) as trades,
         COUNT(CASE WHEN type = 'achievement' THEN 1 END) as achievements
       FROM feeds
       WHERE user_id = $1`,
      [userId]
    );

    return result.rows[0];
  }
}

module.exports = {
  FeedService,
  FeedType,
  Visibility
};
