import { App } from "@slack/bolt";
import { readEnvironment } from "./environment/AppEnvironment";
import { getAllChannelReactionCounts } from './repository/CalculationReactionRepository';
import { createMessageImpl, doTask as doReactionRankingMainTask } from "./services/ReactionRankingService";

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

const printMessageImpl = async (text: string): Promise<void> => {
  console.log(text);

  await publishMessage(app, ReactionRankingChannelId, text)
    .catch(error => console.error(error));
}

const fetchReactionImpl = () => getAllChannelReactionCounts(app);

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

const main = async () => {
  // ランキング機能のメイン処理を実行
  await doReactionRankingMainTask(
    createMessageImpl,
    printMessageImpl,
    fetchReactionImpl,
    getUserNameImpl,
  );
}

main()
