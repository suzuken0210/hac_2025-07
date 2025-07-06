type Reaction = {
  name: string
  count: number
  // TODO: 手が開けばやる
  // creator: string
}

const toReactionFormat = (reaction: Pick<Reaction, "name">): string => {
  return `:${reaction.name}:`
}

const compareByCount = (left: Pick<Reaction, "count">, right: Pick<Reaction, "count">): number => {
    return right.count - left.count
}

export {
  compareByCount, toReactionFormat
}
export type {
  Reaction
}

