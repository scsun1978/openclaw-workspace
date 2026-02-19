/**
 * 关注服务 v1.0.0
 * 实现关注/粉丝/黑名单功能
 */

const { query } = require('./database/db');

/**
 * 关注状态
 */
const FollowStatus = {
  FOLLOWING: 'following',
  MUTUAL: 'mutual',      // 互相关注
  NONE: 'none',
  BLOCKED: 'blocked'
};

/**
 * 关注服务类
 */
class FollowService {
  constructor(cache = null) {
    this.cache = cache || new Map(); // 简单内存缓存模拟 Redis
    this.cacheTTL = 300000; // 5分钟缓存
  }

  /**
   * 关注用户
   */
  async follow(userId, targetUserId) {
    if (userId === targetUserId) {
      throw new Error('不能关注自己');
    }

    // 检查黑名单
    const isBlocked = await this.isBlocked(userId, targetUserId);
    if (isBlocked) {
      throw new Error('对方已将您加入黑名单');
    }

    // 检查是否已关注
    const existing = await this.getFollowStatus(userId, targetUserId);
    if (existing === FollowStatus.FOLLOWING || existing === FollowStatus.MUTUAL) {
      throw new Error('已关注该用户');
    }

    // 添加关注记录
    await query(
      `INSERT INTO user_follows (user_id, target_user_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, target_user_id) DO NOTHING`,
      [userId, targetUserId]
    );

    // 更新粉丝数统计
    await this.updateFollowCount(userId, 'following', 1);
    await this.updateFollowCount(targetUserId, 'followers', 1);

    // 清除缓存
    this.clearCache(userId, targetUserId);

    // 检查是否互相关注
    const isMutual = await this.checkMutual(userId, targetUserId);
    
    return {
      success: true,
      status: isMutual ? FollowStatus.MUTUAL : FollowStatus.FOLLOWING,
      isMutual
    };
  }

  /**
   * 取消关注
   */
  async unfollow(userId, targetUserId) {
    const result = await query(
      `DELETE FROM user_follows 
       WHERE user_id = $1 AND target_user_id = $2
       RETURNING *`,
      [userId, targetUserId]
    );

    if (result.rowCount > 0) {
      // 更新统计
      await this.updateFollowCount(userId, 'following', -1);
      await this.updateFollowCount(targetUserId, 'followers', -1);
      
      // 清除缓存
      this.clearCache(userId, targetUserId);
    }

    return {
      success: true,
      wasFollowing: result.rowCount > 0
    };
  }

  /**
   * 加入黑名单
   */
  async block(userId, targetUserId) {
    // 先取消关注
    await this.unfollow(userId, targetUserId);
    await this.unfollow(targetUserId, userId);

    // 添加黑名单
    await query(
      `INSERT INTO user_blocks (user_id, blocked_user_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT DO NOTHING`,
      [userId, targetUserId]
    );

    this.clearCache(userId, targetUserId);

    return { success: true };
  }

  /**
   * 移除黑名单
   */
  async unblock(userId, targetUserId) {
    await query(
      `DELETE FROM user_blocks 
       WHERE user_id = $1 AND blocked_user_id = $2`,
      [userId, targetUserId]
    );

    this.clearCache(userId, targetUserId);

    return { success: true };
  }

  /**
   * 检查是否被拉黑
   */
  async isBlocked(userId, targetUserId) {
    const cacheKey = `block:${targetUserId}:${userId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached !== undefined) {
      return cached;
    }

    const result = await query(
      `SELECT 1 FROM user_blocks 
       WHERE user_id = $1 AND blocked_user_id = $2`,
      [targetUserId, userId]
    );

    const isBlocked = result.rowCount > 0;
    this.cache.set(cacheKey, isBlocked);
    
    return isBlocked;
  }

  /**
   * 获取关注状态
   */
  async getFollowStatus(userId, targetUserId) {
    if (userId === targetUserId) return 'self';

    const cacheKey = `status:${userId}:${targetUserId}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return cached;

    // 检查黑名单
    if (await this.isBlocked(userId, targetUserId)) {
      return FollowStatus.BLOCKED;
    }

    // 检查关注关系
    const followResult = await query(
      `SELECT 1 FROM user_follows 
       WHERE user_id = $1 AND target_user_id = $2`,
      [userId, targetUserId]
    );

    if (followResult.rowCount === 0) {
      this.cache.set(cacheKey, FollowStatus.NONE);
      return FollowStatus.NONE;
    }

    // 检查互关
    const isMutual = await this.checkMutual(userId, targetUserId);
    const status = isMutual ? FollowStatus.MUTUAL : FollowStatus.FOLLOWING;
    
    this.cache.set(cacheKey, status);
    return status;
  }

  /**
   * 检查互关
   */
  async checkMutual(userId, targetUserId) {
    const result = await query(
      `SELECT COUNT(*) as count FROM user_follows 
       WHERE (user_id = $1 AND target_user_id = $2)
          OR (user_id = $2 AND target_user_id = $1)`,
      [userId, targetUserId]
    );

    return parseInt(result.rows[0].count) === 2;
  }

  /**
   * 获取关注列表
   */
  async getFollowing(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    const result = await query(
      `SELECT uf.target_user_id, uf.created_at, u.username, u.avatar
       FROM user_follows uf
       JOIN users u ON uf.target_user_id = u.id
       WHERE uf.user_id = $1
       ORDER BY uf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * 获取粉丝列表
   */
  async getFollowers(userId, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    
    const result = await query(
      `SELECT uf.user_id, uf.created_at, u.username, u.avatar
       FROM user_follows uf
       JOIN users u ON uf.user_id = u.id
       WHERE uf.target_user_id = $1
       ORDER BY uf.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * 更新关注/粉丝计数
   */
  async updateFollowCount(userId, type, delta) {
    const column = type === 'following' ? 'following_count' : 'followers_count';
    await query(
      `UPDATE user_stats SET ${column} = ${column} + $1 
       WHERE user_id = $2`,
      [delta, userId]
    );
  }

  /**
   * 清除缓存
   */
  clearCache(userId, targetUserId) {
    this.cache.delete(`status:${userId}:${targetUserId}`);
    this.cache.delete(`status:${targetUserId}:${userId}`);
    this.cache.delete(`block:${userId}:${targetUserId}`);
    this.cache.delete(`block:${targetUserId}:${userId}`);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

module.exports = {
  FollowService,
  FollowStatus
};
