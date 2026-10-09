import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GithubModule } from '../github/github.module';

import { GeminiProvider } from './providers/gemini.provider';
import { NvidiaNimProvider } from './providers/nvidia-nim.provider';
import { LlmRotationService } from './services/llm-rotation.service';
import { LlmRateLimiterService } from './services/llm-rate-limiter.service';

import { ApkInspectorService } from './services/apk-inspector.service';
import { JevClientService } from './services/jev-client.service';
import { RulePermissionJudgeService } from './services/rule-permission-judge.service';
import { JevPermissionJudgeService } from './services/jev-permission-judge.service';
import { TrustScoreService } from './services/trust-score.service';
import { SemanticSearchService } from './services/semantic-search.service';
import { SearchTranslatorService } from './services/search-translator.service';
import { JevBenchmarkService } from './benchmark/jev-benchmark.service';
import { GeminiTranslationProvider } from './translation/providers/gemini-translation.provider';
import { NvidiaTranslationProvider } from './translation/providers/nvidia-translation.provider';
import { CloudflareTranslationProvider } from './translation/providers/cloudflare-translation.provider';
import { GroqTranslationProvider } from './translation/providers/groq-translation.provider';
import { TranslationRotationService } from './translation/services/translation-rotation.service';
import { AppDescriptionTranslationService } from './translation/services/app-description-translation.service';
import { ReadmeTranslationService } from './translation/services/readme-translation.service';

@Module({
  imports: [ConfigModule, PrismaModule, RedisModule, GithubModule],
  providers: [
    GeminiProvider,
    NvidiaNimProvider,
    LlmRateLimiterService,
    LlmRotationService,
    ApkInspectorService,
    JevClientService,
    RulePermissionJudgeService,
    JevPermissionJudgeService,
    TrustScoreService,
    SemanticSearchService,
    SearchTranslatorService,
    JevBenchmarkService,
    // Lớp Dịch Dùng Chung Đa Tầng (Shared Translation Engine)
    GeminiTranslationProvider,
    NvidiaTranslationProvider,
    CloudflareTranslationProvider,
    GroqTranslationProvider,
    TranslationRotationService,
    AppDescriptionTranslationService,
    ReadmeTranslationService,
  ],
  exports: [
    LlmRateLimiterService,
    LlmRotationService,
    ApkInspectorService,
    JevClientService,
    JevPermissionJudgeService,
    TrustScoreService,
    SemanticSearchService,
    SearchTranslatorService,
    JevBenchmarkService,
    TranslationRotationService,
    AppDescriptionTranslationService,
    ReadmeTranslationService,
  ],
})
export class AiModule {}
