import { App } from "@slack/bolt";
import { readEnvironment } from "./environment/AppEnvironment";
import { getAllChannelReactionCounts } from "./repository/ReactionRepository";
import { createMessageImpl, doTask as doReactionRankingMainTask } from "./services/ReactionRankingService";

const {
  SLACK_BOT_TOKEN,
  SLACK_APP_TOKEN, // Socket Modeに必要
  SLACK_REACTION_RANKING_CHANNEL_ID: ReactionRankingChannelId,
  SIGNING_SECRET,
} = readEnvironment();

const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN, // Socket Modeに必要
  socketMode: false,
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

// Run the application
async function main(): Promise<void> {
  await doReactionRankingMainTask(
    createMessageImpl,
    printMessageImpl,
    fetchReactionImpl,
  )
}
// Execute main function
main().catch(console.error);