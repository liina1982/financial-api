import { Body, Controller, ForbiddenException, Post } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { TransactionDto } from './dtos/TransactionDto';
import { ApiOperation } from '@nestjs/swagger';
import { TransactionType } from './transactions.entity';
import { TransferDto } from './dtos/TransferDto';
import { Observable } from 'rxjs';
import { Account } from 'src/accounts/account.entity';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('/top-up')
  @ApiOperation({ summary: 'Add money to the account' })
  topUpTransaction(@Body() body: TransactionDto): Promise<Account | Observable<never>> {
    return this.transactionsService.processTopUp(
      TransactionType.TOP_UP,
      body.accountId,
      body.amount,
    );
  }

  @Post('/withdraw')
  @ApiOperation({ summary: 'Withdraw money from the account' })
  withdrawTransaction(@Body() body: TransactionDto): Promise<Account | Observable<never>> {
    return this.transactionsService.processWithdraw(
      TransactionType.WITHDRAWAL,
      body.accountId,
      body.amount,
    );
  }

  @Post('/transfer')
  @ApiOperation({ summary: 'Transfer money from one account to another' })
  transferTransaction(@Body() body: TransferDto): Promise<
    | {
        senderBalance: number;
        receiverBalance: number;
      }
    | boolean
    | Observable<never>
  > {
    if (body.receiverAccountId === body.senderAccountId) {
      throw new ForbiddenException();
    }
    return this.transactionsService.processTransfer(body);
  }
}
