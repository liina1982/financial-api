import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './transactions.entity';
import { Account } from '../accounts/account.entity';
import { LoggerService } from 'src/shared/logger.service';
import { IbanFormatValidator } from 'src/validators/IbanFormatValidator';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Account])],
  controllers: [TransactionsController],
  providers: [TransactionsService, LoggerService, IbanFormatValidator],
  exports: [IbanFormatValidator],
})
export class TransactionsModule {}
