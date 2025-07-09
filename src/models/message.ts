// Slack APIのレスポンスを参考に、必要なプロパティを定義
export interface Message {
    type: string;
    user?: string;
    text?: string;
    ts: string;
    channel?: string;
    thread_ts?: string;
    reply_count?: number;
    reply_users_count?: number;
    latest_reply?: string;
    reactions?: {
        name: string;
        users: string[];
        count: number;
    }[];
}