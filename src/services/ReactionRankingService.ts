import { mapNullable } from "../lib/nullable"
import { sequentiallyFlatMap, sequentialMap } from "../lib/RichPromise"
import { CalculationReaction, compareByCount, Reaction, toReactionFormat } from "../models/reaction"

const RankInLimit = 5
const UserCountLimit = 1

const doTask = async (
    createMessage: (reactionRanking: (Reaction | null)[]) => string,
    printMessage: (text: string) => Promise<void>,
    fetchReaction: () => Promise<CalculationReaction[]>,
    getUserName: (userId: string) => Promise<string | null>,
): Promise<void> => {
    const calculationReactionList = await fetchReaction()
    
    const rankingReaction: (CalculationReaction | null)[] = calculateReactionRanking(calculationReactionList, RankInLimit)
    const rankingReactionWithUserNames: (Reaction | null)[] = await sequentiallyFlatMap(
        rankingReaction,
        async (maybeCalculation) => sequentialMap(
            maybeCalculation === null ? [null] : [maybeCalculation],
            async (nullable): Promise<Reaction | null> => nullable === null ? null : ({ 
                name: nullable.name,
                count: nullable.count, 
                useUserCountMap: await sequentiallyFlatMap(
                    Object.entries(nullable.useUserIdCountMap)
                        .sort(([, l], [, r]) => r - l)
                        .slice(0, UserCountLimit),
                    async ([userId]) => {
                        const maybeUserName = await getUserName(userId)

                        return maybeUserName === null ? [] : [maybeUserName]
                    }
                )
            })
        )
    )

    const maybeMessage = createMessage(rankingReactionWithUserNames)

    printMessage(maybeMessage)
}

const First = 0
const Offset = 1
/*
 * @description
 * rankInLimitとしてランクイン数を指定し、ランクインしたリアクションをランキング順に返却する
 * ランクインしていない順位はnullで埋める
 */
const calculateReactionRanking = (
    reactionList: CalculationReaction[],
    rankInLimit: number,
): (CalculationReaction | null)[] => {
    const aggregatedMap = reactionList.reduce((set: Record<string, Omit<CalculationReaction, "name">>, reaction) => {
        const record = set[reaction.name] ?? { count: 0, useUserIdCountMap: {} }

        return ({
            ...set,
            [reaction.name]: {
                count: reaction.count + record.count,
                useUserIdCountMap: Object.entries(reaction.useUserIdCountMap).reduce((acc, [userId, count]) => {
                    return {
                        ...acc,
                        [userId]: (acc[userId] ?? 0) + count
                    }
                }, record.useUserIdCountMap)
            }
        })
    }, {})
    
    const aggregatedList = Object.entries(aggregatedMap).map<CalculationReaction>(([name, info]) => ({ name, count: info.count, useUserIdCountMap: info.useUserIdCountMap }))

    const sortedByCount: CalculationReaction[] = [...aggregatedList].sort(compareByCount)

    const result = sortedByCount.slice(First, rankInLimit)
    
    return [...result, ...Array(rankInLimit - result.length).fill(null)]
}

const createRankInTemplate = (reaction: Reaction, rankAsIndex: number): string => {
    const rank = rankAsIndex + Offset;
    const formatted = toReactionFormat(reaction);
    const maybeFanUser = reaction.useUserCountMap[0] ?? null
    const fanUserText = mapNullable(maybeFanUser, fanUser => `<- ${fanUser}さんが愛用`) ?? "";

    return `${rank}位: ${formatted} (${reaction.count}回) ${fanUserText}`;
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

