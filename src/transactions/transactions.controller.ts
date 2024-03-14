import { Body, Controller, Post } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionDto } from './dtos/TransactionDto';
import { ApiOperation } from '@nestjs/swagger';
import { TransactionType } from './transactions.entity';
import { TransferDto } from './dtos/TransferDto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('/top-up')
  @ApiOperation({ summary: 'Add money to the account' })
  topUpTransaction(@Body() body: TransactionDto) {
    return this.transactionsService.processTopUp(
      TransactionType.TOP_UP,
      body.accountId,
      body.amount,
    );
  }

  @Post('/withdraw')
  @ApiOperation({ summary: 'Withdraw money from the account' })
  withdrawTransaction(@Body() body: TransactionDto) {
    return this.transactionsService.processWithdraw(
      TransactionType.WITHDRAWAL,
      body.accountId,
      body.amount,
    );
  }

  @Post('/transfer')
  @ApiOperation({ summary: 'Transfer money from one account to another' })
  transferTransaction(@Body() body: TransferDto) {
    console.log('body', body);
    return this.transactionsService.processTransfer(body);
  }
}
