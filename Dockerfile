# 1. ベースとなるNode.jsの公式イメージを選択（Cloud Run Job用）
FROM node:24-alpine

# 2. コンテナ内の作業ディレクトリを作成・指定
WORKDIR /app

# 3. 依存関係のファイルを先にコピー
COPY package*.json ./
COPY tsconfig.json ./

# 4. 依存ライブラリをインストール（devDependenciesも含む）
RUN npm install

# 5. プロジェクトのソースコードを全てコピー
COPY . .

# 6. TypeScriptをビルド
RUN npm run build

# 7. 不要なdevDependenciesを削除（本番環境最適化）
RUN npm prune --production

# 8. Cloud Run Job用の実行コマンド（バッチ処理）
CMD ["node", "dist/app.js"]