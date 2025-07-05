import { App, SayFn, AllMiddlewareArgs, SlackEventMiddlewareArgs } from '@slack/bolt';
import * as dotenv from 'dotenv';

// .envファイルから環境変数を読み込む
dotenv.config();

// ---------------------------------
// 設定項目
// ---------------------------------
// 投稿を取得したいチャンネル名
const TARGET_CHANNEL_NAME = 'times-satou';
// ---------------------------------


// アプリを初期化
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});


/**
 * チャンネル名からチャンネルIDを取得する
 * @param channelName 検索するチャンネル名
 * @returns チャンネルID or null
 */
async function findChannelIdByName(channelName: string): Promise<string | null> {
  try {
    // チャンネルリストを取得
    const result = await app.client.conversations.list({
      limit: 1000,
    });

    if (result.channels) {
      const channel = result.channels.find(c => c.name === channelName);
      return channel?.id || null;
    }
  } catch (error) {
    console.error(`チャンネルリストの取得に失敗しました:`, error);
  }
  return null;
}


/**
 * Botへのメンションイベントを処理するリスナー
 */
app.event('app_mention', async ({ event, say }: SlackEventMiddlewareArgs<'app_mention'> & AllMiddlewareArgs) => {
  console.log(`メンションを受け取りました: user=${event.user}`);

  try {
    // 1. 投稿を取得したいチャンネルのIDを名前から検索
    const channelId = await findChannelIdByName(TARGET_CHANNEL_NAME);

    if (!channelId) {
      await say(`エラー: チャンネル \`#${TARGET_CHANNEL_NAME}\` が見つかりませんでした。`);
      return;
    }
    console.log(`対象チャンネルID: ${channelId}`);

    // 2. チャンネルの投稿履歴を取得 (最新1件)
    const historyResult = await app.client.conversations.history({
      channel: channelId,
      limit: 1, // 取得するメッセージは1件のみ
      inclusive: true,
    });

    const latestMessage = historyResult.messages?.[0];

    if (!latestMessage || !latestMessage.ts) {
      await say(`\`#${TARGET_CHANNEL_NAME}\` にはまだ投稿がありません。`);
      return;
    }
    console.log(`最新メッセージのタイムスタンプ: ${latestMessage.ts}`);

    // 3. 最新メッセージのパーマリンク（固定リンク）を取得
    const permalinkResult = await app.client.chat.getPermalink({
      channel: channelId,
      message_ts: latestMessage.ts,
    });

    if (permalinkResult.ok) {
      // 4. メンションしてきたユーザーにリンクを返信
      await say(`<@${event.user}> さん、どうぞ！\n最新の投稿はこちらです: ${permalinkResult.permalink}`);
    } else {
      throw new Error(`パーマリンクの取得に失敗しました: ${permalinkResult.error}`);
    }

  } catch (error) {
    console.error(error);
    await say('エラーが発生しました。詳細はコンソールログを確認してください。');
  }
});


// アプリを起動
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})();