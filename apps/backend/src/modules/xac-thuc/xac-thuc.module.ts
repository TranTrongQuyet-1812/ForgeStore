import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { XacThucService } from './xac-thuc.service';
import { XacThucController } from './xac-thuc.controller';
import { NguoiDungController } from './nguoi-dung.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ThietBiModule } from '../thiet-bi/thiet-bi.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_TTL', '15m') as `${number}m`,
        },
      }),
    }),
    ThietBiModule,
  ],
  controllers: [XacThucController, NguoiDungController],
  providers: [XacThucService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [XacThucService, JwtAuthGuard, RolesGuard, JwtModule],
})
export class XacThucModule {}
