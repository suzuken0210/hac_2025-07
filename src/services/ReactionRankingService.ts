import { compareByCount, Reaction, toReactionFormat } from "../models/reaction"

const RankInLimit = 5

const doTask = async (
    createMessage: (reactionRanking: (Reaction | null)[]) => string,
    printMessage: (text: string) => Promise<void>,
    fetchReaction: () => Promise<Reaction[]>
): Promise<void> => {
    const reactionList = await fetchReaction()
    
    const rankingReaction: (Reaction | null)[] = calculateReactionRanking(reactionList, RankInLimit)

    const maybeMessage = createMessage(rankingReaction)

    printMessage(maybeMessage)
}

const First = 0
const Offset = 1
/*
 * @description
 * rankInLimitとしてランクイン数を指定し、ランクインしたリアクションをランキング順に返却する
 * ランクインしていない順位はnullで埋める
 */
const calculateReactionRanking = (reactionList: Reaction[], rankInLimit: number): (Reaction | null)[] => {
    const aggregatedMap = reactionList.reduce((set: Record<string, number>, reaction) =>
        ({
            ...set,
            [reaction.name]: reaction.count + (set[reaction.name] ?? 0)
        }), 
        {}
    )
    const aggregatedList = Object.entries(aggregatedMap).map<Reaction>(([name, count]) => ({ name, count }))

    const sortedByCount = [...aggregatedList].sort(compareByCount)

    const result = sortedByCount.slice(First, rankInLimit)
    
    return [...result, ...Array(rankInLimit - result.length).fill(null)]
}

const createRankInTemplate = (reaction: Reaction, rankAsIndex: number): string => {
    const rank = rankAsIndex + Offset;
    const formatted = toReactionFormat(reaction);

    return `${rank}位: ${formatted} (${reaction.count}回)`;
  }

  const createNotRankInTemplate = (_reaction: null, rankAsIndex: number): string => {
    const rank = rankAsIndex + Offset;

    return `${rank}位: ランクインなし`;
  }

const createMessageImpl = (reactionRanking: (Reaction | null)[]): string => {
    const message = reactionRanking.map(
        (_, index) => _ === null 
        ? createNotRankInTemplate(_, index) 
        : createRankInTemplate(_, index)
    ).join("\n");

    return message
}
export {
    createMessageImpl, doTask
}

