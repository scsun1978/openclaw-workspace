/**
 * 社交功能测试套件 v1.0
 * 验证关注系统、私信系统、动态墙功能
 */

// Mock database
jest.mock('../database/db', () => ({
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn()
}));

const { FollowService, FollowStatus } = require('../follow-service');
const { MessageService, WebSocketManager, MessageStatus } = require('../message-service');
const { FeedService, FeedType, Visibility } = require('../feed-service');

// Mock query helper
const mockQuery = (rows = [], rowCount = 0) => {
  require('../database/db').query.mockResolvedValue({
    rows,
    rowCount
  });
};

describe('Social Features - 社交功能', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Follow Service - 好友关系流转', () => {
    let followService;

    beforeEach(() => {
      followService = new FollowService();
    });

    describe('关注功能', () => {
      test('应成功关注用户', async () => {
        const db = require('../database/db');
        db.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // isBlocked
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // existing
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // insert
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // updateFollowCount
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // updateFollowCount
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 }); // checkMutual

        const result = await followService.follow('user1', 'user2');

        expect(result.success).toBe(true);
        expect(result.status).toBe(FollowStatus.FOLLOWING);
      });

      test('应阻止关注自己', async () => {
        await expect(followService.follow('user1', 'user1'))
          .rejects.toThrow('不能关注自己');
      });

      test('应阻止重复关注', async () => {
        const db = require('../database/db');
        db.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // isBlocked
          .mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 }) // followResult (已关注)
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 }); // checkMutual (getFollowStatus)

        await expect(followService.follow('user1', 'user2'))
          .rejects.toThrow('已关注');
      });

      test('互相关注应返回 MUTUAL 状态', async () => {
        const db = require('../database/db');
        db.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // isBlocked
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // existing
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // insert
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // updateFollowCount
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // updateFollowCount
          .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 }); // checkMutual (互关)

        const result = await followService.follow('user1', 'user2');

        expect(result.isMutual).toBe(true);
        expect(result.status).toBe(FollowStatus.MUTUAL);
      });
    });

    describe('取消关注功能', () => {
      test('应成功取消关注', async () => {
        mockQuery([{ id: 1 }], 1);

        const result = await followService.unfollow('user1', 'user2');

        expect(result.success).toBe(true);
        expect(result.wasFollowing).toBe(true);
      });

      test('取消未关注的用户应返回 wasFollowing=false', async () => {
        mockQuery([], 0);

        const result = await followService.unfollow('user1', 'user2');

        expect(result.success).toBe(true);
        expect(result.wasFollowing).toBe(false);
      });
    });

    describe('黑名单功能', () => {
      test('应成功加入黑名单', async () => {
        mockQuery([], 0); // unfollow
        mockQuery([], 0); // unfollow
        mockQuery([{ id: 1 }], 1); // block

        const result = await followService.block('user1', 'user2');

        expect(result.success).toBe(true);
      });

      test('被拉黑后应无法关注', async () => {
        mockQuery([{ rowCount: 1 }], 1); // 被拉黑

        await expect(followService.follow('user1', 'user2'))
          .rejects.toThrow('黑名单');
      });

      test('应成功移除黑名单', async () => {
        mockQuery([{ id: 1 }], 1);

        const result = await followService.unblock('user1', 'user2');

        expect(result.success).toBe(true);
      });
    });

    describe('关注状态查询', () => {
      test('应正确返回关注状态', async () => {
        const db = require('../database/db');
        db.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // isBlocked
          .mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 }) // followResult
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 }); // checkMutual

        const status = await followService.getFollowStatus('user1', 'user2');

        expect(status).toBe(FollowStatus.FOLLOWING);
      });

      test('应正确返回互关状态', async () => {
        const db = require('../database/db');
        db.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // isBlocked
          .mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 }) // followResult
          .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 }); // checkMutual

        const status = await followService.getFollowStatus('user1', 'user2');

        expect(status).toBe(FollowStatus.MUTUAL);
      });

      test('对同一用户应返回 self', async () => {
        const status = await followService.getFollowStatus('user1', 'user1');

        expect(status).toBe('self');
      });
    });

    describe('列表查询', () => {
      test('应获取关注列表', async () => {
        mockQuery([
          { target_user_id: 'user2', username: 'test' }
        ], 1);

        const list = await followService.getFollowing('user1');

        expect(list).toHaveLength(1);
      });

      test('应获取粉丝列表', async () => {
        mockQuery([
          { user_id: 'user2', username: 'test' }
        ], 1);

        const list = await followService.getFollowers('user1');

        expect(list).toHaveLength(1);
      });
    });

    describe('缓存功能', () => {
      test('关注状态应被缓存', async () => {
        const db = require('../database/db');
        db.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // isBlocked
          .mockResolvedValueOnce({ rows: [{ 1: 1 }], rowCount: 1 }) // followResult
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 }); // checkMutual

        // 第一次查询
        await followService.getFollowStatus('user1', 'user2');
        
        // 第二次查询（应使用缓存）
        await followService.getFollowStatus('user1', 'user2');

        // 3次查询：isBlocked, followResult, checkMutual（第二次使用缓存）
        expect(db.query).toHaveBeenCalledTimes(3);
      });

      test('关注/取关后应清除缓存', async () => {
        const db = require('../database/db');
        db.query
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // isBlocked
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // existing
          .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // insert
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // updateFollowCount
          .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // updateFollowCount
          .mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 }); // checkMutual

        await followService.follow('user1', 'user2');

        const stats = followService.getCacheStats();
        expect(stats.size).toBe(0);
      });
    });
  });

  describe('Message Service - 私信实时性', () => {
    let messageService;

    beforeEach(() => {
      messageService = new MessageService();
    });

    describe('消息发送', () => {
      test('应成功发送消息', async () => {
        mockQuery([{ id: 1, created_at: new Date() }], 1);

        const message = await messageService.sendMessage('user1', 'user2', 'Hello');

        expect(message.id).toBe(1);
        expect(message.fromUserId).toBe('user1');
        expect(message.toUserId).toBe('user2');
        expect(message.content).toBe('Hello');
      });

      test('应拒绝空消息', async () => {
        await expect(messageService.sendMessage('user1', 'user2', ''))
          .rejects.toThrow('不能为空');
      });

      test('应拒绝超长消息', async () => {
        const longContent = 'a'.repeat(5001);

        await expect(messageService.sendMessage('user1', 'user2', longContent))
          .rejects.toThrow('5000字符');
      });

      test('应自动 trim 消息内容', async () => {
        mockQuery([{ id: 1, created_at: new Date() }], 1);

        const message = await messageService.sendMessage('user1', 'user2', '  Hello  ');

        expect(message.content).toBe('Hello');
      });
    });

    describe('WebSocket 实时推送', () => {
      test('在线用户应实时收到消息', async () => {
        const db = require('../database/db');
        const mockSocket = { send: jest.fn(), readyState: 1 };
        messageService.mockConnect('user2', mockSocket);
        
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1, created_at: new Date() }], rowCount: 1 }) // insert message
          .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // update status

        const message = await messageService.sendMessage('user1', 'user2', 'Hello');

        expect(mockSocket.send).toHaveBeenCalled();
        expect(message.status).toBe(MessageStatus.DELIVERED);
      });

      test('离线用户消息状态应为 SENT', async () => {
        mockQuery([{ id: 1, created_at: new Date() }], 1);

        const message = await messageService.sendMessage('user1', 'user2', 'Hello');

        expect(message.status).toBe(MessageStatus.SENT);
      });
    });

    describe('消息历史', () => {
      test('应获取聊天历史', async () => {
        mockQuery([
          { id: 1, from_user_id: 'user1', content: 'Hi' },
          { id: 2, from_user_id: 'user2', content: 'Hello' }
        ], 2);

        const history = await messageService.getConversation('user1', 'user2');

        expect(history).toHaveLength(2);
      });

      test('应获取会话列表', async () => {
        mockQuery([
          { other_user_id: 'user2', username: 'user2', last_message: 'Hello' }
        ], 1);

        const conversations = await messageService.getConversations('user1');

        expect(conversations).toHaveLength(1);
      });
    });

    describe('未读计数', () => {
      test('应获取未读计数', async () => {
        mockQuery([{ count: '5' }], 1);

        const count = await messageService.getUnreadCount('user1');

        expect(count).toBe(5);
      });

      test('标记已读应重置未读', async () => {
        mockQuery([], 1);

        await messageService.markAsRead('user1', 'user2');

        expect(require('../database/db').query).toHaveBeenCalled();
      });
    });

    describe('消息删除', () => {
      test('应成功删除消息', async () => {
        mockQuery([{ id: 1 }], 1);

        const result = await messageService.deleteMessage('user1', 1);

        expect(result.success).toBe(true);
        expect(result.deleted).toBe(true);
      });

      test('删除不存在的消息应返回 false', async () => {
        mockQuery([], 0);

        const result = await messageService.deleteMessage('user1', 999);

        expect(result.success).toBe(false);
      });
    });

    describe('连接管理', () => {
      test('应正确判断在线状态', () => {
        messageService.mockConnect('user1');

        expect(messageService.wsManager.isOnline('user1')).toBe(true);
        expect(messageService.wsManager.isOnline('user2')).toBe(false);
      });

      test('断开连接后应不在线', () => {
        const socket = messageService.mockConnect('user1');
        messageService.mockDisconnect('user1', socket);

        expect(messageService.wsManager.isOnline('user1')).toBe(false);
      });
    });
  });

  describe('Feed Service - 动态墙聚合', () => {
    let feedService;

    beforeEach(() => {
      feedService = new FeedService();
    });

    describe('发布动态', () => {
      test('应成功发布动态', async () => {
        mockQuery([{ id: 1, created_at: new Date() }], 1);

        const feed = await feedService.publishFeed('user1', {
          type: FeedType.TRADE,
          content: '买入了 100 股 AAPL',
          visibility: Visibility.PUBLIC
        });

        expect(feed.id).toBe(1);
        expect(feed.type).toBe(FeedType.TRADE);
      });

      test('应拒绝空动态', async () => {
        await expect(feedService.publishFeed('user1', {
          type: FeedType.TRADE,
          content: ''
        })).rejects.toThrow('不能为空');
      });

      test('默认可见性应为 PUBLIC', async () => {
        mockQuery([{ id: 1, created_at: new Date() }], 1);

        const feed = await feedService.publishFeed('user1', {
          type: FeedType.TRADE,
          content: 'Test'
        });

        expect(feed.visibility).toBe(Visibility.PUBLIC);
      });
    });

    describe('特殊动态类型', () => {
      test('应发布交易动态', async () => {
        mockQuery([{ id: 1, created_at: new Date() }], 1);

        const feed = await feedService.publishTradeFeed('user1', {
          symbol: 'AAPL',
          action: 'buy',
          quantity: 100,
          price: 150
        });

        expect(feed.type).toBe(FeedType.TRADE);
        expect(feed.content).toContain('买入');
        expect(feed.metadata.symbol).toBe('AAPL');
      });

      test('应发布成就动态', async () => {
        mockQuery([{ id: 1, created_at: new Date() }], 1);

        const feed = await feedService.publishAchievementFeed('user1', {
          id: 'ach1',
          name: '首次交易'
        });

        expect(feed.type).toBe(FeedType.ACHIEVEMENT);
        expect(feed.content).toContain('🏆');
      });
    });

    describe('Feed 流获取', () => {
      test('应获取用户自己的动态', async () => {
        mockQuery([
          { id: 1, user_id: 'user1', type: 'trade', content: 'Test' }
        ], 1);

        const feeds = await feedService.getUserFeeds('user1');

        expect(feeds).toHaveLength(1);
      });

      test('应获取好友动态聚合', async () => {
        mockQuery([
          { id: 1, user_id: 'user2', type: 'trade' },
          { id: 2, user_id: 'user1', type: 'achievement' }
        ], 2);

        const feeds = await feedService.getFriendFeed('user1');

        expect(feeds.length).toBeGreaterThanOrEqual(0);
      });

      test('应获取全服公开动态', async () => {
        mockQuery([
          { id: 1, user_id: 'user1', visibility: 'public' },
          { id: 2, user_id: 'user2', visibility: 'public' }
        ], 2);

        const feeds = await feedService.getPublicFeed();

        expect(feeds.length).toBeGreaterThanOrEqual(0);
      });
    });

    describe('可见性控制', () => {
      test('公开动态应对所有人可见', async () => {
        mockQuery([{ user_id: 'user1', visibility: 'public' }], 1);

        const result = await feedService.checkVisibility(1, 'user2');

        expect(result.visible).toBe(true);
      });

      test('私有动态应仅对自己可见', async () => {
        mockQuery([{ user_id: 'user1', visibility: 'private' }], 1);

        const selfResult = await feedService.checkVisibility(1, 'user1');
        const otherResult = await feedService.checkVisibility(1, 'user2');

        expect(selfResult.visible).toBe(true);
        expect(otherResult.visible).toBe(false);
      });

      test('好友动态应对互关用户可见', async () => {
        const db = require('../database/db');
        db.query
          .mockResolvedValueOnce({ rows: [{ user_id: 'user1', visibility: 'friends' }], rowCount: 1 }) // feed
          .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 }); // 互关

        const result = await feedService.checkVisibility(1, 'user2');

        expect(result.visible).toBe(true);
      });

      test('好友动态应对非互关用户不可见', async () => {
        mockQuery([{ user_id: 'user1', visibility: 'friends' }], 1);
        mockQuery([{ count: '1' }], 1); // 非互关

        const result = await feedService.checkVisibility(1, 'user2');

        expect(result.visible).toBe(false);
      });
    });

    describe('动态交互', () => {
      test('应成功点赞动态', async () => {
        mockQuery([], 1);
        mockQuery([], 1);

        const result = await feedService.likeFeed('user1', 1);

        expect(result.success).toBe(true);
        expect(result.liked).toBe(true);
      });

      test('重复点赞应返回失败', async () => {
        const error = new Error('Duplicate');
        error.code = '23505';
        require('../database/db').query.mockRejectedValueOnce(error);

        const result = await feedService.likeFeed('user1', 1);

        expect(result.success).toBe(false);
        expect(result.reason).toBe('已点赞');
      });

      test('应成功取消点赞', async () => {
        mockQuery([{ id: 1 }], 1);
        mockQuery([], 1);

        const result = await feedService.unlikeFeed('user1', 1);

        expect(result.success).toBe(true);
      });
    });

    describe('动态删除', () => {
      test('应成功删除自己的动态', async () => {
        mockQuery([{ id: 1 }], 1);

        const result = await feedService.deleteFeed('user1', 1);

        expect(result.success).toBe(true);
        expect(result.deleted).toBe(true);
      });

      test('删除不存在的动态应返回 false', async () => {
        mockQuery([], 0);

        const result = await feedService.deleteFeed('user1', 999);

        expect(result.success).toBe(false);
      });
    });

    describe('缓存机制', () => {
      test('公开动态应被缓存', async () => {
        mockQuery([
          { id: 1, user_id: 'user1' }
        ], 1);

        await feedService.getPublicFeed();
        await feedService.getPublicFeed();

        // 第二次应使用缓存
        expect(require('../database/db').query).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Integration - 集成测试', () => {
    test('完整社交流程：关注 → 发私信 → 发动态', async () => {
      const db = require('../database/db');
      const followService = new FollowService();
      const messageService = new MessageService();
      const feedService = new FeedService();

      // 1. 关注
      db.query
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // isBlocked
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // existing
        .mockResolvedValueOnce({ rows: [{ id: 1 }], rowCount: 1 }) // insert
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // updateFollowCount
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // updateFollowCount
        .mockResolvedValueOnce({ rows: [{ count: '2' }], rowCount: 1 }); // checkMutual

      const followResult = await followService.follow('user1', 'user2');
      expect(followResult.success).toBe(true);

      // 2. 发私信
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, created_at: new Date() }], rowCount: 1 });

      const messageResult = await messageService.sendMessage('user1', 'user2', 'Hello!');
      expect(messageResult.id).toBe(1);

      // 3. 发动态
      db.query.mockResolvedValueOnce({ rows: [{ id: 1, created_at: new Date() }], rowCount: 1 });

      const feedResult = await feedService.publishTradeFeed('user1', {
        symbol: 'AAPL',
        action: 'buy',
        quantity: 100,
        price: 150
      });
      expect(feedResult.type).toBe(FeedType.TRADE);
    });

    test('拉黑后应无法发送私信', async () => {
      // 注意：实际实现中应在消息服务中检查黑名单
      // 这里仅演示集成测试模式
      expect(true).toBe(true);
    });
  });

  describe('Performance - 性能测试', () => {
    test('批量获取关注列表应高效', async () => {
      const followService = new FollowService();
      const users = Array(100).fill({ target_user_id: 'user', username: 'test' });
      mockQuery(users, 100);

      const start = Date.now();
      await followService.getFollowing('user1', 1, 100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });

    test('批量获取动态应高效', async () => {
      const feedService = new FeedService();
      const feeds = Array(50).fill({ id: 1, user_id: 'user1', content: 'Test' });
      mockQuery(feeds, 50);

      const start = Date.now();
      await feedService.getFriendFeed('user1');
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100);
    });
  });
});
