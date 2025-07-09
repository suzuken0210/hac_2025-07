import { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(__dirname, 'logs');
const getLogFilePath = () => {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return path.join(LOG_DIR, `engagement_log_${today}.csv`);
};

/**
 * 1時間ごとに呼び出され、直近1時間のメッセージデータを収集し、CSVファイルに記録します。
 * @param app - Boltアプリのインスタンス
 */
export async function logHourlyData(app: App) {
  try {
    // ログディレクトリが存在しない場合は作成
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR);
    }
    
    const logFilePath = getLogFilePath();
    const isFileNew = !fs.existsSync(logFilePath);

    // CSVのヘッダーを書き込む（ファイルが新規作成された場合のみ）
    if (isFileNew) {
      fs.writeFileSync(logFilePath, 'timestamp,message_ts,channel_id,user_id,reaction_count,reply_count,unique_reply_users_count\n');
    }

    console.log('対象チャンネルのリストを取得中...');
    const targetChannels = await listTargetChannels(app.client);
    console.log(`${targetChannels.length}件のチャンネルを対象にデータ収集を開始します。`);

    const messages = await fetchMessagesFromLastHour(app.client, targetChannels);
    console.log(`直近1時間で${messages.length}件の親投稿が見つかりました。`);

    let processedCount = 0;
    for (const message of messages) {
      if (!message.channel) continue;
      
      const reactionCount = message.reactions ? message.reactions.reduce((sum: number, r: { count: number }) => sum + r.count, 0) : 0;
      let replyCount = 0;
      let uniqueReplyUsersCount = 0;

      if (message.reply_count && message.reply_count > 0) {
        const replies = await app.client.conversations.replies({ channel: message.channel, ts: message.ts, limit: 1000 });
        if (replies.messages) {
          const replyMessages = replies.messages.slice(1);
          replyCount = replyMessages.length;
          uniqueReplyUsersCount = new Set(replyMessages.map(r => r.user)).size;
        }
      }

      // ログに記録するのは、何らかのエンゲージメントがあった投稿のみ
      if (reactionCount > 0 || replyCount > 0) {
        const logEntry = [
          new Date().toISOString(),
          message.ts,
          message.channel,
          message.user,
          reactionCount,
          replyCount,
          uniqueReplyUsersCount
        ].join(',') + '\n';

        fs.appendFileSync(logFilePath, logEntry);
        processedCount++;
      }
    }
    console.log(`データ収集完了。${processedCount}件のエンゲージメントをログに記録しました。`);

  } catch (error) {
    console.error('時間ごとのデータ収集中にエラーが発生しました:', error);
  }
}

// チャンネルリスト取得関数（変更なし）
async function listTargetChannels(client: WebClient): Promise<{ id: string; name: string }[]> {
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

// 直近1時間のメッセージ取得関数
async function fetchMessagesFromLastHour(client: WebClient, channels: { id: string }[]) {
  const oneHourAgo = String(Math.floor((Date.now() - 60 * 60 * 1000) / 1000));
  
  const messagePromises = channels.map(channel =>
    client.conversations.history({ channel: channel.id, oldest: oneHourAgo, limit: 200 })
      .then(result => ({ result, channelId: channel.id }))
  );

  const results = await Promise.all(messagePromises);
  const allMessages = results.flatMap(({ result, channelId }) => (result.messages as any[] || []).map(m => ({ ...m, channel: channelId })));
  
  // スレッドの親投稿のみをフィルタリング
  return allMessages.filter(m => !m.thread_ts || m.ts === m.thread_ts);
}
