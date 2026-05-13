FROM mcr.microsoft.com/playwright:v1.59.1-noble

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

RUN mkdir -p /app/output && chmod 777 /app/output

ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME=0.0.0.0

EXPOSE 7860

CMD ["pnpm", "start"]
