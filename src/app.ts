import { App } from "@slack/bolt";
import { readEnvironment } from "./environment/AppEnvironment";
import { doEngagementRankingTask } from './services/EngagementRankingService';
import { doReactionRankingTask } from "./services/ReactionRankingService";

const {
  SLACK_BOT_TOKEN,
  SLACK_APP_TOKEN,
  SLACK_REACTION_RANKING_CHANNEL_ID: ReactionRankingChannelId,
  SIGNING_SECRET,
  NODE_ENV = "development",
} = readEnvironment();

const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN,
  socketMode: NODE_ENV === "development",
  signingSecret: SIGNING_SECRET,
});

async function publishMessage(app: App, id: string, text: string) {
  return app.client.chat.postMessage({
    channel: id,
    text: text
  });
}

// const printMessageImpl = async (text: string): Promise<void> => {
//   console.log(text);

//   await publishMessage(app, ReactionRankingChannelId, text)
//     .catch(error => console.error(error));
// }

// const fetchReactionImpl = () => getAllChannelReactionCounts(app);

// ユーザー名を取得する関数
const getUserNameImpl = async (userId: string): Promise<string | null> => {
  try {
    const result = await app.client.users.info({
      user: userId
    });
    return result.user?.real_name || result.user?.name || null;
  } catch (error) {
    console.error(`Error getting user name for ${userId}:`, error);
    return null;
  }
};

/**
 * 新しい「リアクション使用数」ランキングのメイン処理（ブロックUI対応）
 */
const runReactionRanking = async () => {
    await doReactionRankingTask(app, ReactionRankingChannelId);
};

/**
 * 新しい「投稿の盛り上がり」ランキングのメイン処理
 */
const runEngagementRanking = async () => {
    await doEngagementRankingTask(app, ReactionRankingChannelId);
};

// --- アプリケーションの起動 ---
(async () => {
  console.log('⚡️ Bolt app is running!');

  // 起動時にリアクションランキングを実行
  runReactionRanking();

  // 起動時に投稿ランキングを実行
  runEngagementRanking();
})();
