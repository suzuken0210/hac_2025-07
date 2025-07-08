import { App } from "@slack/bolt";
import { Channel } from "@slack/web-api/dist/types/response/ConversationsListResponse";
import { sequentiallyFlatMap } from "../lib/RichPromise";
import { Message } from "../models/message";
import { ConversationsHistoryResponse } from "@slack/web-api";
import { mapNullable } from "../lib/nullable";

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(() => {
  console.log("delay", ms);
  resolve();
}, ms));

const giveDelay = <A extends unknown[], B>(
  ms: number, task: (...a: A) => Promise<B>
): ((...a: A) => Promise<B>) => {
  return (...a: A) => delay(ms).then(() => task(...a));
}

async function getAllChannels(app: App): Promise<Channel[]> {
  try {
    const result = await app.client.conversations.list({
      types: 'public_channel,private_channel',
      limit: 1000
    });
    return result.channels ?? [];
  } catch (error) {
    console.error('Error getting channels:', error);
    return [];
  }
}

const getPast168HoursTimestamp = (): string => {
  const now = new Date();
  const hoursAgo = 168;
  const pastDate = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
  return (pastDate.getTime() / 1000).toString();
};

async function getChannelHistory(
  app: App,
  channelId: string,
): Promise<ConversationsHistoryResponse[]> {

  const go = async (
    task: (cursor: string | undefined) => Promise<ConversationsHistoryResponse>
  ): Promise<ConversationsHistoryResponse[]> => {
    const result: ConversationsHistoryResponse[] = []
    let currentCursor: string | undefined;

    do {
      const response = await task(currentCursor);
      result.push(response);
      currentCursor = response.response_metadata?.next_cursor;
    } while (currentCursor)

    return result;
  }

  const oldest = getPast168HoursTimestamp();

  const fetchChannelHistoryTask = (cursor: string | undefined) => app.client.conversations.history({
    channel: channelId,
    cursor: cursor,
    oldest,
  });

  try {
    return await go(giveDelay(1000, fetchChannelHistoryTask));
  } catch (error) {
    console.error(`Error getting history for channel ${channelId}:`, error);
    return [];
  }
}


async function getAllMessagesFromTimesChannels(app: App): Promise<Message[]> {
  const allChannels = await getAllChannels(app);
  const timesChannels = allChannels.filter(c => c.is_member && c.name?.match(/^times[-]/));

  console.log(`Found ${timesChannels.length} times channels.`);

  const messages = await sequentiallyFlatMap(timesChannels, async (channel) => {
    console.log(`Fetching history for channel: ${channel.name}`);
    const history = await getChannelHistory(app, channel.id!);
    const slackMessages = history.flatMap(h => h.messages ?? []);

    return slackMessages.map((m) => ({
      channelId: channel.id!,
      channelName: channel.name!,
      ts: m.ts!,
      text: m.text!,
      userId: m.user!,
      replyCount: m.reply_count ?? 0,
    })).filter(m => m.text && m.userId);
  });

  return messages;
}

const getPermalink = async (app: App, channelId: string, messageTs: string): Promise<string | null> => {
  try {
    const result = await app.client.chat.getPermalink({
      channel: channelId,
      message_ts: messageTs,
    });
    return result.permalink ?? null;
  } catch (error) {
    console.error(`Error getting permalink for message ${messageTs} in channel ${channelId}:`, error);
    return null;
  }
};

export { getAllMessagesFromTimesChannels, getPermalink }; 