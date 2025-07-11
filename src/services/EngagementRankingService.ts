import { App } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { Message } from "../models/message"; // 新しいモデルを定義
import { getMessagesForEngagementRanking } from "../repository/CalculationReactionRepository";

// --- 型定義 ---
interface RankedMessage {
  score: number;
  message: Message;
  channel: { id: string; name: string };
  user: { name: string };
  link: string;
}

// --- メイン処理 ---
export const doEngagementRankingTask = async (app: App, postChannelId: string, messages?: Message[]) => {
    console.log({messages})
    console.log("投稿の盛り上がりランキング集計を開始します...");
    try {
        const targetMessages = messages || await getMessagesForEngagementRanking(app);
        const scoredMessages = await calculateScores(app.client, targetMessages);
        const top5Messages = scoredMessages.sort((a, b) => b.score - a.score).slice(0, 5);

        top5Messages.forEach(message => console.log({
            top5Message: message,
        }))

        // console.log(top5Messages)

        await postRanking(app.client, postChannelId, top5Messages);
        console.log("ランキングの投稿が完了しました。");

    } catch (error) {
        console.error("投稿ランキングの生成中にエラーが発生しました:", error);
        await app.client.chat.postMessage({
            channel: postChannelId,
            text: `ランキングの集計中にエラーが発生しました: ${error}`
        });
    }
}

// --- スコア計算ロジック ---
async function calculateScores(client: WebClient, messages: Message[]): Promise<RankedMessage[]> {
    const rankedMessages: RankedMessage[] = [];
    const usersCache = new Map<string, string>();
    const channelsCache = new Map<string, string>();

    for (const message of messages) {
        if (!message.channel) continue;

        const reactionScore = message.reactions?.reduce((sum, r) => sum + r.count, 0) ?? 0;
        
        let replyUsersScore = 0;
        let replyCountScore = 0;
        if (message.reply_count && message.reply_count > 0) {
            const replies = await client.conversations.replies({ channel: message.channel, ts: message.ts, limit: 1000 });
            if (replies.messages) {
                const replyMessages = replies.messages.slice(1);
                replyCountScore = replyMessages.length;
                const uniqueReplyUsers = new Set(replyMessages.map(r => r.user));
                replyUsersScore = uniqueReplyUsers.size;
            }
        }
        
        const totalScore = (replyUsersScore * 0.5) + (replyCountScore * 0.3) + (reactionScore * 0.2);

        if (totalScore > 0) {
            // --- ユーザー名・チャンネル名・パーマリンクの取得 ---
            if (!!message.user && !usersCache.has(message.user)) {
                const res = await client.users.info({ user: message.user });
                if (res.ok) usersCache.set(message.user, (res.user as any).real_name || (res.user as any).name);
            }
            if (!channelsCache.has(message.channel)) {
                const res = await client.conversations.info({ channel: message.channel });
                if (res.ok) channelsCache.set(message.channel, (res.channel as any).name);
            }
            const permalink = await client.chat.getPermalink({ channel: message.channel, message_ts: message.ts });

            rankedMessages.push({
                score: totalScore,
                message: message,
                channel: { id: message.channel, name: channelsCache.get(message.channel) || '不明' },
                user: { name: usersCache.get(message.user!) || '不明' },
                link: permalink.permalink!,
            });
        }
    }
    return rankedMessages;
}

// --- ランキング投稿ロジック ---
async function postRanking(client: WebClient, channelId: string, ranking: RankedMessage[]) {
    if (ranking.length === 0) {
        await client.chat.postMessage({
            channel: channelId,
            text: "この1週間で盛り上がった投稿はありませんでした :zany_face:",
        });
        return;
    }

    const blocks = [
        {
            "type": "header",
            "text": { "type": "plain_text", "text": `🎉 この1週間の盛り上がり投稿ランキング！`, "emoji": true }
        },
        { "type": "divider" },
        ...ranking.flatMap((item, index) => {
            // Slack形式のリンクを変換する処理
            const processedText = (
                item.message.text
                    ?.replace(/<([^|>]+)\|([^>]+)>/g, '$2')  // <URL|テキスト> → テキスト
                    ?.replace(/<([^>]+)>/g, '$1')            // <URL> → URL
                    ?.slice(0, 80) ?? ""
        ) + "..."
                
            
            return [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": `*${index + 1}位* (スコア: ${item.score.toFixed(2)})\n${processedText?.split("\n").map(_ => `*<${item.link}|${_}>*`).join("\n")}\n:bust_in_silhouette: *${item.user.name}* |  :slack: #${item.channel.name}`
                    }
                },
                { "type": "divider" }
            ];
        })
    ];

    await client.chat.postMessage({
        channel: channelId,
        text: "この1週間の盛り上がり投稿ランキング！",
        blocks: blocks
    });
}