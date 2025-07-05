import os
from slack_bolt import App
# Socket Modeを有効にするために必要なライブラリ
from slack_bolt.adapter.socket_mode import SocketModeHandler

# Botトークンだけでアプリを初期化します
app = App(
    token=os.environ.get("SLACK_BOT_TOKEN")
)

# Botにメンションが送られた時の処理
@app.event("app_mention")
def handle_mention(event, say):
    # メンションしてきたユーザーのIDを取得
    user_id = event["user"]
    # メッセージを組み立てて返信
    say(f"<@{user_id}> こんにちは！")

# アプリを起動
if __name__ == "__main__":
    # 環境変数から SLACK_APP_TOKEN を使ってSocket Modeハンドラーを起動します
    SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"]).start()