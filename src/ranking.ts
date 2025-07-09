import { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';

// --- 型定義 (変更なし) ---
interface Message {
  user: string;
  text: string;
  ts: string;
  channel?: string;
  thread_ts?: string;
  reply_count?: number;
  reactions?: { name: string; users: string[]; count: number }[];
}

interface RankedMessage {
  score: number;
  message: Message;
  channel: { id: string; name: string };
  user: { name: string };
  link: string;
}

/**
 * 日次のエンゲージメントランキングを生成し、指定されたチャンネルに投稿します。
 * この関数が、app.tsからスケジュール実行されます。
 * @param app - Boltアプリのインスタンス
 */
export async function generateAndPostDailyRanking(app: App) {
  console.log('ランキング集計を開始します...');
  try {
    const targetChannels = await listTargetChannels(app.client);
    const allMessages = await fetchAllMessagesFromYesterday(app.client, targetChannels);
    const scoredMessages = await calculateScores(app.client, allMessages);
    const top5Messages = scoredMessages.sort((a, b) => b.score - a.score).slice(0, 5);
    
    const postChannelName = 'DemoNasu'; // 投稿先のチャンネル名
    await postRanking(app.client, postChannelName, top5Messages);

    console.log('ランキングの投稿が完了しました。');
  } catch (error) {
    console.error('ランキング生成中にエラーが発生しました:', error);
  }
}

/**
 * #cl- または #times- で始まるパブリックチャンネルのリストを取得します。
 */
async function listTargetChannels(client: WebClient): Promise<{ id: string; name: string }[]> {
    // 省略（前回のコードと同じ）
    const allChannels: any[] = [];
    let cursor: string | undefined;
    do {
      const result = await client.conversations.list({ limit: 200, cursor: cursor, exclude_archived: true });
      if (result.channels) allChannels.push(...result.channels);
      cursor = result.response_metadata?.next_cursor;
    } while (cursor);
    return allChannels
      .filter(c => c.name && (c.name.startsWith('cl-') || c.name.startsWith('times-')))
      .map(c => ({ id: c.id!, name: c.name! }));
}

/**
 * 複数のチャンネルから「昨日1日分」のメッセージをすべて取得します。
 */
async function fetchAllMessagesFromYesterday(client: WebClient, channels: { id: string }[]): Promise<Message[]> {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const dayBeforeYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2);

  const oldest = String(Math.floor(dayBeforeYesterday.getTime() / 1000));
  const latest = String(Math.floor(yesterday.getTime() / 1000));
  
  const messagePromises = channels.map(channel =>
    client.conversations.history({ channel: channel.id, oldest: oldest, latest: latest, limit: 200 })
      .then(result => ({ result, channelId: channel.id }))
  );

  const results = await Promise.all(messagePromises);
  return results.flatMap(({ result, channelId }) => (result.messages as Message[] || []).map(m => ({ ...m, channel: channelId })));
}


/**
 * メッセージのリストを受け取り、それぞれのエンゲージメントスコアを計算します。
 */
async function calculateScores(client: WebClient, messages: Message[]): Promise<RankedMessage[]> {
    // 省略（前回のコードと同じ、ただしchannel情報をmessageオブジェクトから取得するよう変更）
    const scoredMessages: RankedMessage[] = [];
    const usersCache = new Map<string, string>();
    const channelsCache = new Map<string, string>(); // チャンネル名もキャッシュ
    
    const parentMessages = messages.filter(m => !m.thread_ts || m.ts === m.thread_ts);

    for (const message of parentMessages) {
        if (!message.channel) continue;

        // スコア計算ロジック...
        const reactionScore = message.reactions ? message.reactions.reduce((sum, r) => sum + r.count, 0) : 0;
        let replyUsersScore = 0;
        let replyCountScore = 0;
        if (message.reply_count && message.reply_count > 0) {
            const replies = await client.conversations.replies({ channel: message.channel, ts: message.ts });
            if (replies.messages) {
                const replyMessages = replies.messages.slice(1);
                replyCountScore = replyMessages.length;
                replyUsersScore = new Set(replyMessages.map(r => r.user)).size;
            }
        }
        const totalScore = (replyUsersScore * 0.6) + (replyCountScore * 0.4) + (reactionScore * 0.2);

        if (totalScore > 0) {
            // ユーザー情報とチャンネル情報を取得
            if (!usersCache.has(message.user)) {
                const userResult = await client.users.info({ user: message.user });
                if (userResult.ok) usersCache.set(message.user, (userResult.user as any).real_name || (userResult.user as any).name);
            }
            if (!channelsCache.has(message.channel)) {
                const channelResult = await client.conversations.info({ channel: message.channel });
                if (channelResult.ok) channelsCache.set(message.channel, (channelResult.channel as any).name);
            }
            const userName = usersCache.get(message.user) || '不明';
            const channelName = channelsCache.get(message.channel) || '不明';
            
            const permalinkResult = await client.chat.getPermalink({ channel: message.channel, message_ts: message.ts });

            scoredMessages.push({
                score: totalScore,
                message: message,
                channel: { id: message.channel, name: channelName },
                user: { name: userName },
                link: permalinkResult.permalink!,
            });
        }
    }
    return scoredMessages;
}


/**
 * ランキング結果を指定されたチャンネルに投稿します。
 */
async function postRanking(client: WebClient, postChannelName: string, ranking: RankedMessage[]) {
    // 省略（前回のコードと同じ）
    const channelsResult = await client.conversations.list({ limit: 1000 });
    const targetChannel = channelsResult.channels?.find(c => c.name === postChannelName);
    if (!targetChannel) {
        console.error(`投稿先チャンネル #${postChannelName} が見つかりません。`);
        return;
    }
    // Block Kitの作成と投稿...
    if (ranking.length === 0) {
        await client.chat.postMessage({ channel: targetChannel.id!, text: "昨日の盛り上がった投稿はありませんでした :sleeping:" });
        return;
    }
    const blocks = [
        { "type": "header", "text": { "type": "plain_text", "text": `🎉 昨日の盛り上がり投稿ランキング！`, "emoji": true } },
        { "type": "divider" },
        ...ranking.flatMap((item, index) => [
            { "type": "section", "text": { "type": "mrkdwn", "text": `*${index + 1}位* (スコア: ${item.score.toFixed(2)})\n*<${item.link}|「${item.message.text.slice(0, 80)}...」>*\n:bust_in_silhouette: *${item.user.name}* |  :slack: #${item.channel.name}` } },
            { "type": "divider" }
        ])
    ];
    await client.chat.postMessage({ channel: targetChannel.id!, text: "昨日の盛り上がり投稿ランキング！", blocks: blocks });
}
