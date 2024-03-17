import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Account } from './account.entity';
import { AccountNotFoundException } from 'src/exceptions/account-not-found.exception';

@Injectable()
export class AccountsService {
  constructor(private readonly entityManager: EntityManager) {}

  create(userId: number, iban: string): Promise<Account> {
    const account = this.entityManager
      .getRepository(Account)
      .create({ userId, iban });
    return this.entityManager.save(account);
  }

  async findAll(): Promise<Account[]> {
    const accounts = await this.entityManager.find(Account);
    return accounts.map((account) => {
      account.balance = account.balance / 100;
      return account
    })
  }

  async findOne(id: number): Promise<Account> {
    const account =  await this.entityManager.getRepository(Account).findOneBy({ id });
    if(!account) {
      throw new AccountNotFoundException();
    }
    account.balance = account.balance / 100;
    return account;
  }

  findIban(iban: string): Promise<boolean> {
    return this.entityManager.getRepository(Account).existsBy({ iban });
  }
}
