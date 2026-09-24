import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GithubModule } from '../github/github.module';

import { GeminiProvider } from './providers/gemini.provider';
import { NvidiaNimProvider } from './providers/nvidia-nim.provider';
import { LlmRotationService } from './services/llm-rotation.service';
import { AiFallbackRetryJob } from './jobs/ai-fallback-retry.job';

import { ApkInspectorService } from './services/apk-inspector.service';
import { JevClientService } from './services/jev-client.service';
import { RulePermissionJudgeService } from './services/rule-permission-judge.service';
import { JevPermissionJudgeService } from './services/jev-permission-judge.service';
import { TrustScoreService } from './services/trust-score.service';
import { SemanticSearchService } from './services/semantic-search.service';
import { JevBenchmarkService } from './benchmark/jev-benchmark.service';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, GithubModule],
  providers: [
    GeminiProvider,
    NvidiaNimProvider,
    LlmRotationService,
    AiFallbackRetryJob,
    ApkInspectorService,
    JevClientService,
    RulePermissionJudgeService,
    JevPermissionJudgeService,
    TrustScoreService,
    SemanticSearchService,
    JevBenchmarkService,
  ],
  exports: [
    LlmRotationService,
    ApkInspectorService,
    JevClientService,
    JevPermissionJudgeService,
    TrustScoreService,
    SemanticSearchService,
    JevBenchmarkService,
  ],
})
export class AiModule {}
