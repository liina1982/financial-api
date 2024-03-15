import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CreateAccountDto } from './dtos/CreateAccountDto';
import { AccountsService } from './accounts.service';
import { Account } from './account.entity';
import { ApiOperation } from '@nestjs/swagger';

@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Post()
  @ApiOperation({ summary: 'Create account' })
  createAccount(@Body() body: CreateAccountDto): Promise<Account> {
    return this.accountsService.create(body.userId, body.iban);
  }

  @Get('/:id')
  @ApiOperation({ summary: 'Get account with account id' })
  async getAccount(@Param('id') id: number): Promise<Account> {
    let account: Account = null;
    account = await this.accountsService.findOne(id);
    if (!account) {
      throw new NotFoundException(`Account not found with id ${id}`);
    }
    return account;
  }

  @Get()
  @ApiOperation({ summary: 'Get list of accounts' })
  getAccounts(): Promise<Account[]> {
    return this.accountsService.findAll();
  }
}
