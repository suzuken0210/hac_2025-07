import * as dotenv from "dotenv";

/** 
 * @description
 * process.envを取得し、必要な環境変数が定義されているかを確認する。
 * 定義されていない場合はエラーを投げる。
 */
function getOrThrows(env: NodeJS.ProcessEnv): Record<string, unknown> {
  if (env.SLACK_BOT_TOKEN === undefined) {
    throw new Error("SLACK_BOT_TOKEN is not defined in environment variables.");
  }
  if (env.SLACK_APP_TOKEN === undefined) {
    throw new Error("SLACK_APP_TOKEN is not defined in environment variables.");
  }
  if (env.SLACK_REACTION_RANKING_CHANNEL_ID === undefined) {
    throw new Error("SLACK_REACTION_RANKING_CHANNEL_ID is not defined in environment variables.");
  }
  if (env.SIGNING_SECRET === undefined) {
    throw new Error("SIGNING_SECRET is not defined in environment variables.");
  }
  return env;
}

type EnvironmentVariables = {
    SLACK_BOT_TOKEN: string;
    SLACK_APP_TOKEN: string;
    SLACK_REACTION_RANKING_CHANNEL_ID: string;
    SIGNING_SECRET: string;
    NODE_ENV?: string;
}

/**
 * @description
 * 環境変数を読み込み、必要な変数が定義されているかを確認する。
 * 定義されていない場合はエラーを投げる。
 * 
 * @returns 環境変数のオブジェクト
 */
const readEnvironment = (): EnvironmentVariables => {
    // Load environment variables
    dotenv.config();

    const environment = process.env

    return getOrThrows(environment) as EnvironmentVariables
}

export { readEnvironment };
export type { EnvironmentVariables };

