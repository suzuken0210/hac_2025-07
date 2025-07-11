import { App } from "@slack/bolt";
import { readEnvironment } from "./environment/AppEnvironment";
import { getRankingData } from './repository/CalculationReactionRepository';
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
 * 共通データを取得して両方のランキングを効率的に実行
 */
const runBothRankings = async () => {
    console.log("📊 ランキングデータの取得を開始します...");
    try {
        // 一度のAPIコールで両方のランキングに必要なデータを取得
        const rankingData = await getRankingData(app, ReactionRankingChannelId);
        
        console.log("🎯 両方のランキングを並行実行します...");
        
        // 両方のランキングを並行実行
        await Promise.all([
            doReactionRankingTask(app, ReactionRankingChannelId, rankingData.reactions),
            doEngagementRankingTask(app, ReactionRankingChannelId, rankingData.messages)
        ]);
        
        console.log("✅ 全てのランキング処理が完了しました！");
        
    } catch (error) {
        console.error("ランキング処理中にエラーが発生しました:", error);
    }
};

// --- アプリケーションの起動 ---
(async () => {
  console.log('⚡️ Bolt app is running!');

  // 起動時に両方のランキングを効率的に実行
  runBothRankings();
})();
