import { App } from "@slack/bolt";
import { readEnvironment } from "./environment/AppEnvironment";
import { getAllChannelReactionCounts } from "./repository/CalculationReactionRepository";
import { getUserInformation } from "./repository/UserInformationRepository";
import { createMessageImpl, doTask as doReactionRankingMainTask } from "./services/ReactionRankingService";

const {
  SLACK_BOT_TOKEN,
  SLACK_APP_TOKEN,
  SLACK_REACTION_RANKING_CHANNEL_ID: ReactionRankingChannelId,
  SIGNING_SECRET,
} = readEnvironment();

const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN,
  socketMode: true, // 本番ではfalseにしてWeb APIを使う
  signingSecret: SIGNING_SECRET,
})

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

const getUserInfoImpl = (userId: string) => getUserInformation(app, userId)

// Run the application
async function main(): Promise<void> {
  await doReactionRankingMainTask(
    createMessageImpl,
    printMessageImpl,
    fetchReactionImpl,
    getUserInfoImpl,
  )
}
// Execute main function
main().catch(console.error);