import { App } from "@slack/bolt";
import { readEnvironment } from "./environment/AppEnvironment";
import { getAllChannelReactionCounts } from './repository/CalculationReactionRepository';
import { createMessageImpl, doTask as doReactionRankingMainTask } from "./services/ReactionRankingService";
import { doEngagementRankingTask } from './services/EngagementRankingService'; 

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
 * 既存の「リアクション使用数」ランキングのメイン処理
 */
const runReactionRanking = async () => {
  console.log("リアクション使用数ランキングの集計を開始します...");
  const printMessageImpl = async (text: string): Promise<void> => {
    console.log(text);
    await publishMessage(app, ReactionRankingChannelId, text)
      .catch(error => console.error(error));
  }
  const fetchReactionImpl = () => getAllChannelReactionCounts(app);

  await doReactionRankingMainTask(
    createMessageImpl,
    printMessageImpl,
    fetchReactionImpl,
    getUserNameImpl,
  );
};

/**
 * 新しい「投稿の盛り上がり」ランキングのメイン処理
 */
const runEngagementRanking = async () => {
    await doEngagementRankingTask(app, ReactionRankingChannelId);
};


// --- イベントリスナーとスケジュール設定 ---

// Botへのメンションで「投稿ランキング」集計を実行
app.event('app_mention', async ({ event, say }) => {
    if (event.text.includes('投稿ランキング')) {
        await say(`承知しました！この1週間の投稿の盛り上がりを集計します... :hourglass_flowing_sand:`);
        // 非同期で実行し、すぐにレスポンスを返す
        runEngagementRanking().catch(console.error);
    }
});


/**
 * 【定期実行】週に1回、毎週土曜日の午前10時に実行
 * 本番環境で有効化する場合は、このコメントアウトを解除してください。
 * cron書式: '分 時 日 月 曜日' (0 10 * * 6 は「毎週土曜日の10時0分」)
 */
/*
cron.schedule('0 10 * * 6', () => {
  console.log(`[${new Date().toLocaleString()}] 週次の投稿ランキング生成タスクを開始します...`);
  runEngagementRanking();
}, {
  timezone: "Asia/Tokyo"
});
*/


// --- アプリケーションの起動 ---
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');

  // 起動時に既存のリアクションランキングを実行
  // ※不要な場合はこの行をコメントアウトしてください
  runReactionRanking();
})();
