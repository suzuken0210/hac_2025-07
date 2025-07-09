import { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(__dirname, 'logs');
const getLogFilePath = () => {
    const today = new Date().toISOString().slice(0, 10);
    return path.join(LOG_DIR, `engagement_log_${today}.csv`);
};

interface LogData {
  message_ts: string;
  channel_id: string;
  user_id: string;
  reaction_count: number;
  reply_count: number;
  unique_reply_users_count: number;
}

interface RankedMessage {
  score: number;
  text: string;
  link: string;
  user: { name: string };
  channel: { name: string };
}

/**
 * 1日の終わりに呼び出され、その日のログファイルからランキングを生成・投稿します。
 * @param app - Boltアプリのインスタンス
 */
export async function generateAndPostDailyRanking(app: App) {
  try {
    const logFilePath = getLogFilePath();
    if (!fs.existsSync(logFilePath)) {
      console.log('本日のログファイルが見つかりません。投稿をスキップします。');
      return;
    }

    console.log(`ログファイル ${logFilePath} を読み込んでいます...`);
    const logData = parseLogFile(logFilePath);
    
    console.log(`${logData.size}件のユニークな投稿を対象にランキングを生成します。`);
    const ranking = await createRanking(app.client, logData);
    
    const top5 = ranking.sort((a, b) => b.score - a.score).slice(0, 5);
    
    const postChannelName = 'DemoNasu';
    console.log(`#${postChannelName} にランキングを投稿します。`);
    await postRanking(app.client, postChannelName, top5);

    // 処理済みのログファイルをリネーム
    fs.renameSync(logFilePath, `${logFilePath}.processed`);
    console.log('ランキング生成と投稿が完了しました。');

  } catch (error) {
    console.error('日次ランキングの生成中にエラーが発生しました:', error);
  }
}

// CSVログファイルをパースし、メッセージごとに集計する
function parseLogFile(filePath: string): Map<string, LogData> {
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const lines = fileContent.split('\n').slice(1); // ヘッダーを除外
  const messageData = new Map<string, LogData>();

  for (const line of lines) {
    if (!line) continue;
    const [timestamp, message_ts, channel_id, user_id, reaction_count, reply_count, unique_reply_users_count] = line.split(',');
    
    // 最新のデータで上書きする（時間ごとに収集するため、最後のデータが最も正確）
    messageData.set(message_ts, {
      message_ts,
      channel_id,
      user_id,
      reaction_count: parseInt(reaction_count, 10),
      reply_count: parseInt(reply_count, 10),
      unique_reply_users_count: parseInt(unique_reply_users_count, 10),
    });
  }
  return messageData;
}

// 集計データからランキングリストを作成する
async function createRanking(client: WebClient, logData: Map<string, LogData>): Promise<RankedMessage[]> {
  const rankedMessages: RankedMessage[] = [];
  const usersCache = new Map<string, string>();
  const channelsCache = new Map<string, string>();
  const messageTextCache = new Map<string, string>();

  for (const [ts, data] of logData.entries()) {
    const totalScore = (data.unique_reply_users_count * 0.5) + (data.reply_count * 0.3) + (data.reaction_count * 0.2); // 1.0になるように修正しました、、、

    // ユーザー、チャンネル、メッセージ本文情報を取得（キャッシュ利用）
    if (!usersCache.has(data.user_id)) {
        const res = await client.users.info({ user: data.user_id });
        if (res.ok) usersCache.set(data.user_id, (res.user as any).real_name || (res.user as any).name);
    }
    if (!channelsCache.has(data.channel_id)) {
        const res = await client.conversations.info({ channel: data.channel_id });
        if (res.ok) channelsCache.set(data.channel_id, (res.channel as any).name);
    }
    if (!messageTextCache.has(ts)) {
        const res = await client.conversations.history({ channel: data.channel_id, latest: ts, oldest: ts, inclusive: true, limit: 1 });
        if (res.ok && res.messages && res.messages.length > 0) {
            messageTextCache.set(ts, res.messages[0].text || '');
        }
    }
    
    const permalink = await client.chat.getPermalink({ channel: data.channel_id, message_ts: ts });

    rankedMessages.push({
        score: totalScore,
        text: messageTextCache.get(ts)?.slice(0, 80) + '...' || '（本文取得不可）',
        link: permalink.permalink!,
        user: { name: usersCache.get(data.user_id) || '不明' },
        channel: { name: channelsCache.get(data.channel_id) || '不明' },
    });
  }
  return rankedMessages;
}


// ランキング結果を投稿する関数（Block Kit部分は変更なし）
async function postRanking(client: WebClient, postChannelName: string, ranking: RankedMessage[]) {
    const channelsResult = await client.conversations.list({ limit: 1000 });
    const targetChannel = channelsResult.channels?.find(c => c.name === postChannelName);
    if (!targetChannel) {
        console.error(`投稿先チャンネル #${postChannelName} が見つかりません。`);
        return;
    }
    if (ranking.length === 0) {
        await client.chat.postMessage({ channel: targetChannel.id!, text: "昨日の盛り上がった投稿はありませんでした :sleeping:" });
        return;
    }
    const blocks = [
        { "type": "header", "text": { "type": "plain_text", "text": `🎉 昨日の盛り上がり投稿ランキング！`, "emoji": true } },
        { "type": "divider" },
        ...ranking.flatMap((item, index) => [
            { "type": "section", "text": { "type": "mrkdwn", "text": `*${index + 1}位* (スコア: ${item.score.toFixed(2)})\n*<${item.link}|「${item.text}」>*\n:bust_in_silhouette: *${item.user.name}* |  :slack: #${item.channel.name}` } },
            { "type": "divider" }
        ])
    ];
    await client.chat.postMessage({ channel: targetChannel.id!, text: "昨日の盛り上がり投稿ランキング！", blocks: blocks });
}
