import { App } from "@slack/bolt";
import { ConversationsHistoryResponse } from "@slack/web-api";
import { Reaction as RawReaction } from "@slack/web-api/dist/types/response/ConversationsHistoryResponse";
import { mapNullable, Nullable } from "../lib/nullable";
import { sequentiallyFlatMap } from "../lib/RichPromise";
import { CalculationReaction } from "../models/reaction";

interface ChannelInfo {
  id: string;
  name: string;
  is_channel: boolean;
  is_private: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_member: boolean;
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(() => {
        console.log("delay", ms);
        resolve();
    }, ms));

async function getAllChannels(app: App): Promise<ChannelInfo[]> {
  try {
    // Get public channels
    const publicChannels = await app.client.conversations.list({
      types: 'public_channel',
      limit: 1000
    });

    const result = publicChannels.channels?.map(channel => ({
        id: channel.id!,
        name: channel.name!,
        is_channel: channel.is_channel ?? false,
        is_private: false,
        is_im: false,
        is_mpim: false,
        is_member: channel.is_member ?? false,
    })) ?? []

    return result;
  } catch (error) {
    console.error('Error getting channels:', error);
    return [];
  }
}

const giveDelay = <A extends unknown[], B>(
    ms: number, task: (...a: A) => Promise<B>
): ((...a: A) => Promise<B>) => {
  return (...a: A) => delay(ms).then(() => task(...a));
}

// Get channel history with pagination
async function getChannelHistory(
    app: App,
    channelId: string,
    channelName: string
): Promise<ConversationsHistoryResponse[]> {

  const go = async (
    task: (cursor: string | undefined) => Promise<ConversationsHistoryResponse>
  ): Promise<ConversationsHistoryResponse[]> => {  
    const result: ConversationsHistoryResponse[] = []
    let currentCursor: string | undefined;

    do {
        console.log("do")
        const response = await task(currentCursor);
        console.log("done")
        console.log(response.messages?.map(m => m.text).join('\n'));
        
        result.push(response);
        currentCursor = response.response_metadata?.next_cursor;
    } while (currentCursor)
        
    return result;
  }

  const fetchChannelHistoryTask = (cursor: string | undefined) => app.client.conversations.history({
    channel: channelId,
    cursor: cursor
  })

  try {
    return await go(giveDelay(1000, fetchChannelHistoryTask))
  } catch (error) {
    console.error(`Error getting history for channel ${channelName} (${channelId}):`, error);
    return [];
  }
}

// Main function to get all channel histories
async function getAllChannelHistories(app: App): Promise<ConversationsHistoryResponse[]> {
  try {
    console.log('🔍 Fetching all channels...');
    const channels = await getAllChannels(app)
      .then(_ => _.filter(channel => channel.is_channel && channel.is_member && channel.name))

    console.log(channels.map(c => c.name));
    
    console.log(`📊 Found ${channels.length} channels`);
    
    const result = await sequentiallyFlatMap(
        channels,
        channel => giveDelay(10000, getChannelHistory)(app, channel.id, channel.name)
    )

    return result
  } catch (error) {
    console.error('Error in getAllChannelHistories:', error);
    return [];
  }
}

async function getAllChannelReactionCounts(app: App): Promise<CalculationReaction[]> {
  const historyList = await getAllChannelHistories(app)
  
  const reactionList: CalculationReaction[] = historyList.flatMap(history => 
    history.messages?.flatMap(message => {
      const maybeRawReactions = message.reactions ?? null
      
      const maybeReactions = mapNullable(
        maybeRawReactions, 
        rawReactions => rawReactions.map(extractReactions).filter(_ => _ !== null)
      )

      return maybeReactions === null ? [] : maybeReactions
    }) ?? []
  )

  return reactionList
}

function extractReactions({ 
  count: rawCount,
  name: rawName,
  users: rawUsers,
}: RawReaction): Nullable<CalculationReaction> {
  const maybeCount = rawCount ?? null;
  const maybeName = rawName ?? null;
  const maybeUserIds = rawUsers ?? null;

  if (maybeCount === null || maybeName === null) {
    return null;
  }

  return ({
    count: maybeCount,
    name: maybeName,
    useUserIdCountMap: Object.fromEntries(maybeUserIds?.map(id => [id, 1]) ?? [])
  });
}

export {
  getAllChannelReactionCounts
};

