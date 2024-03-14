import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Account } from './account.entity';

@Injectable()
export class AccountsService {
  constructor(private readonly entityManager: EntityManager) {}

  create(userId: number, iban: string): Promise<Account> {
    const account = this.entityManager
      .getRepository(Account)
      .create({ userId, iban });
    return this.entityManager.save(account);
  }

  findAll(): Promise<Account[]> {
    return this.entityManager.find(Account);
  }

  findOne(id: number): Promise<Account> {
    return this.entityManager.getRepository(Account).findOneBy({ id });
  }

  findIban(iban: string): Promise<Account> {
    return this.entityManager.getRepository(Account).findOneBy({ iban });
  }
}
