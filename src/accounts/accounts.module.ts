import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './account.entity';
import { UniqueIbanValidator } from '../validators/UniqueIbanValidator';

@Module({
  imports: [TypeOrmModule.forFeature([Account])],
  controllers: [AccountsController],
  providers: [AccountsService, UniqueIbanValidator],
})
export class AccountsModule {}
