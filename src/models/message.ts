export type Message = {
  channelId: string;
  channelName: string;
  ts: string;
  text: string;
  userId: string;
  replyCount: number;
};

export const compareByReplyCount = (left: Message, right: Message): number => {
  return right.replyCount - left.replyCount;
}; 