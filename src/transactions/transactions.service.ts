import { Injectable, NotFoundException } from '@nestjs/common';
import { Transaction } from './transactions.entity';
import { EntityManager } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { TransactionType } from '../transactions/transactions.entity';
import { TransferDto } from './dtos/TransferDto';
import { InsufficientFundsException } from 'src/exceptions/insufficient-funds.exception';
import Decimal from 'decimal.js';

@Injectable()
export class TransactionsService {
  constructor(private readonly entityManager: EntityManager) {}

  async processTopUp(
    type: TransactionType,
    id: number,
    amount: number,
  ): Promise<Transaction> {
    const topUpAmount = new Decimal(amount).toDecimalPlaces(2).toNumber();
    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const account = await transactionalEntityManager
          .getRepository(Account)
          .createQueryBuilder()
          .where('id = :id', { id: id })
          .getOne();

        if (!account) {
          throw new NotFoundException(`Account not found with id ${id}`);
        }

        account.balance += topUpAmount;
        await transactionalEntityManager.getRepository(Account).save(account);

        const transaction = this.createTransaction(
          account.iban,
          topUpAmount,
          type,
        );
        await transactionalEntityManager
          .getRepository(Transaction)
          .save(transaction);

        return transaction;
      },
    );
  }

  async processWithdraw(
    type: TransactionType,
    accountId: number,
    amount: number,
  ): Promise<Transaction> {
    const withdrawAmount = new Decimal(amount).toDecimalPlaces(2).toNumber();
    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const account = await transactionalEntityManager
          .getRepository(Account)
          .createQueryBuilder()
          .where('id = :id', { id: accountId })
          .getOne();

        if (!account) {
          throw new NotFoundException(`Account not found with id ${accountId}`);
        }

        if (account.balance < withdrawAmount) {
          throw new InsufficientFundsException();
        }

        const transaction = this.createTransaction(
          account.iban,
          withdrawAmount,
          type,
        );
        await transactionalEntityManager
          .getRepository(Transaction)
          .save(transaction);

        account.balance -= withdrawAmount;
        await transactionalEntityManager.getRepository(Account).save(account);

        return transaction;
      },
    );
  }

  async processTransfer(transferDto: TransferDto) {
    const transferAmount = new Decimal(transferDto.amount)
      .toDecimalPlaces(2)
      .toNumber();
    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const senderAccount = await transactionalEntityManager
          .getRepository(Account)
          .createQueryBuilder()
          .where('id = :id', { id: transferDto.senderAccountId })
          .getOneOrFail();

        const receiverAccount = await transactionalEntityManager
          .getRepository(Account)
          .createQueryBuilder()
          .where('id = :id', { id: transferDto.receiverAccountId })
          .getOneOrFail();

        if (senderAccount.balance < transferAmount) {
          throw new Error('Insufficient funds');
        }

        senderAccount.balance -= transferAmount;
        receiverAccount.balance += transferAmount;

        await transactionalEntityManager.save(senderAccount);
        await transactionalEntityManager.save(receiverAccount);

        const senderTransaction = this.createTransaction(
          senderAccount.iban,
          transferAmount,
          TransactionType.TRANSFER,
        );
        await transactionalEntityManager
          .getRepository(Transaction)
          .save(senderTransaction);

        const receiverTransaction = this.createTransaction(
          receiverAccount.iban,
          transferAmount,
          TransactionType.RECEIVE,
        );
        await transactionalEntityManager
          .getRepository(Transaction)
          .save(receiverTransaction);

        return {
          senderBalance: senderAccount.balance,
          receiverBalance: receiverAccount.balance,
        };
      },
    );
  }

  createTransaction(iban: string, amount: number, type: TransactionType) {
    const transaction = new Transaction();
    transaction.amount = amount;
    transaction.iban = iban;
    transaction.type = type;
    return transaction;
  }
}
