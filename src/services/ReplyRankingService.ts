import { Message, compareByReplyCount } from "../models/message";
import { mapNullable } from "../lib/nullable";

const doTask = async (
  createMessage: (topMessage: Message | null, userName: string | null, permalink: string | null) => string,
  printMessage: (text: string) => Promise<void>,
  fetchMessages: () => Promise<Message[]>,
  getUserName: (userId: string) => Promise<string | null>,
  getPermalink: (channelId: string, messageTs: string) => Promise<string | null>,
): Promise<void> => {
  const messages = await fetchMessages();
  if (messages.length === 0) {
    printMessage("直近1週間に投稿されたtimesのメッセージはありませんでした。");
    return;
  }

  const sortedMessages = [...messages].sort(compareByReplyCount);
  const topMessage = sortedMessages[0];

  if (topMessage.replyCount === 0) {
    printMessage("直近1週間のtimesチャンネルであまり盛り上がっている投稿はありませんでした。");
    return;
  }

  const [userName, permalink] = await Promise.all([
    getUserName(topMessage.userId),
    getPermalink(topMessage.channelId, topMessage.ts),
  ]);

  const message = createMessage(topMessage, userName, permalink);
  printMessage(message);
};

const createMessageImpl = (topMessage: Message | null, userName: string | null, permalink: string | null): string => {
  if (!topMessage || !userName || !permalink) {
    return "情報の取得に失敗しました。";
  }

  const userText = mapNullable(userName, name => `@${name}`) ?? "不明なユーザー";

  const header = `【週間times返信王👑】\n直近1週間で最も返信が多かった投稿はこちらです！`;
  const messageInfo = `投稿者: ${userText} さん\nチャンネル: #${topMessage.channelName}\n返信数: ${topMessage.replyCount}件`;
  const link = `投稿はこちら: ${permalink}`;

  return `${header}\n\n${messageInfo}\n${link}`;
};

export { doTask, createMessageImpl }; 