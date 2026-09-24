import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '../redis/redis.module';
import { GithubService } from './github.service';

@Module({
  imports: [ConfigModule, RedisModule],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
