type CalculationReaction = {
  name: string
  count: number
  useUserIdCountMap: Record<string, number> // ユーザーID,使用回数の
}

type Reaction = {
  name: string
  count: number
  useUserCountMap: string[] // ユーザ名の配列。リアクションをつけたユーザの名前を格納する
}

const toReactionFormat = (reaction: Record<"name", string>): string => {
  return `:${reaction.name}:`
}

const compareByCount = (left: CalculationReaction, right: CalculationReaction): number => {
    return right.count - left.count
}

export {
  compareByCount, toReactionFormat
}
export type { CalculationReaction, Reaction }

