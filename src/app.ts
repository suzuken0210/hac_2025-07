import { App } from '@slack/bolt';
import * as dotenv from 'dotenv';

// .envファイルから環境変数を読み込む
dotenv.config();

// アプリを初期化
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN, // Socket Modeに必要
  socketMode: true, // Socket Modeを有効にする
});

// Botへのメンションをリッスン
app.event('app_mention', async ({ event, say }) => {
  try {
    // メンションしてきたユーザーに返信
    await say(`<@${event.user}> こんにちは！`);
  } catch (error) {
    console.error(error);
  }
});

// アプリを起動
(async () => {
  await app.start();
  console.log('⚡️ Bolt app is running!');
})();