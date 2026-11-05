import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { GithubModule } from '../github/github.module';

import { GeminiProvider } from './providers/gemini.provider';
import { NvidiaNimProvider } from './providers/nvidia-nim.provider';
import { LlmRotationService } from './services/llm-rotation.service';
import { LlmRateLimiterService } from './services/llm-rate-limiter.service';

import { ApkInspectorService } from './services/apk-inspector.service';
import { RulePermissionJudgeService } from './services/rule-permission-judge.service';
import { BO_PHAN_DOAN_QUYEN } from './interfaces/permission-judge.interface';
import { TrustScoreService } from './services/trust-score.service';
import { SemanticSearchService } from './services/semantic-search.service';
import { SearchTranslatorService } from './services/search-translator.service';
import { GeminiTranslationProvider } from './translation/providers/gemini-translation.provider';
import { NvidiaTranslationProvider } from './translation/providers/nvidia-translation.provider';
import { CloudflareTranslationProvider } from './translation/providers/cloudflare-translation.provider';
import { GroqTranslationProvider } from './translation/providers/groq-translation.provider';
import {
  GEMINI_31_TRANSLATION_PROVIDER,
  GEMINI_35_TRANSLATION_PROVIDER,
  TranslationRotationService,
} from './translation/services/translation-rotation.service';
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
    { provide: BO_PHAN_DOAN_QUYEN, useClass: RulePermissionJudgeService },
    TrustScoreService,
    SemanticSearchService,
    SearchTranslatorService,
    // Lớp Dịch Dùng Chung Đa Tầng (Shared Translation Engine)
    {
      provide: GEMINI_31_TRANSLATION_PROVIDER,
      useFactory: (config: ConfigService, limiter: LlmRateLimiterService) =>
        new GeminiTranslationProvider(config, limiter, 'gemini-3.1-flash-lite'),
      inject: [ConfigService, LlmRateLimiterService],
    },
    {
      provide: GEMINI_35_TRANSLATION_PROVIDER,
      useFactory: (config: ConfigService, limiter: LlmRateLimiterService) =>
        new GeminiTranslationProvider(config, limiter, 'gemini-3.5-flash-lite'),
      inject: [ConfigService, LlmRateLimiterService],
    },
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
    TrustScoreService,
    SemanticSearchService,
    SearchTranslatorService,
    TranslationRotationService,
    AppDescriptionTranslationService,
    ReadmeTranslationService,
  ],
})
export class AiModule {}
