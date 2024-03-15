import { ForbiddenException, Injectable } from '@nestjs/common';
import { Transaction } from './transactions.entity';
import { EntityManager, QueryRunner } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { TransactionType } from '../transactions/transactions.entity';
import { TransferDto } from './dtos/TransferDto';
import { InsufficientFundsException } from 'src/exceptions/insufficient-funds.exception';
import Decimal from 'decimal.js';
import { AccountNotFoundException } from 'src/exceptions/account-not-found.exception';
import { Observable, throwError } from 'rxjs';

@Injectable()
export class TransactionsService {
  constructor(private readonly entityManager: EntityManager) {}

  async processTopUp(
    type: TransactionType,
    id: number,
    amount: number,
  ): Promise<boolean> {
    const topUpAmount = new Decimal(amount).toDecimalPlaces(2).toNumber();
    return await this.updateAccountBalance(id, topUpAmount, type);
  }

  async processWithdraw(
    type: TransactionType,
    accountId: number,
    amount: number,
  ): Promise<boolean> {
    const withdrawAmount = new Decimal(amount).toDecimalPlaces(2).toNumber();
    return await this.updateAccountBalance(accountId, withdrawAmount, type);
  }

  async processTransfer(transferDto: TransferDto): Promise<
    | {
        senderBalance: number;
        receiverBalance: number;
      }
    | boolean
    | Observable<never>
  > {
    const transferAmount = new Decimal(transferDto.amount)
      .toDecimalPlaces(2)
      .toNumber();
    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const connection = transactionalEntityManager.connection;
        const queryRunner = connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          const senderAccount = await this.getAccountFromDB(
            queryRunner,
            transferDto.senderAccountId,
          );

          const receiverAccount = await this.getAccountFromDB(
            queryRunner,
            transferDto.receiverAccountId,
          );

          if (senderAccount.balance < transferAmount) {
            throw new Error('Insufficient funds');
          }

          senderAccount.balance -= transferAmount;
          receiverAccount.balance += transferAmount;

          await this.updateAccountBalance(
            senderAccount.userId,
            senderAccount.balance,
            TransactionType.TRANSFER,
          );

          await this.updateAccountBalance(
            receiverAccount.userId,
            receiverAccount.balance,
            TransactionType.RECEIVE,
          );

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
          await queryRunner.commitTransaction();

          return {
            senderBalance: senderAccount.balance,
            receiverBalance: receiverAccount.balance,
          };
        } catch (error) {
          await queryRunner.rollbackTransaction();
          console.error(error);
          return throwError(() => error);
        } finally {
          await queryRunner.release();
        }
        return false;
      },
    );
  }

  async updateAccountBalances(
    accountId: number,
    balance: number,
    type: TransactionType,
  ): Promise<boolean> {
    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const connection = transactionalEntityManager.connection;
        const queryRunner = connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          return this.saveAccountToDB(queryRunner, accountId, balance, type);
        } catch (err) {
          await queryRunner.rollbackTransaction();
          console.error(err);
          return false;
        } finally {
          await queryRunner.release();
        }
      },
    );
  }

  async updateAccountBalance(
    accountId: number,
    balance: number,
    type: TransactionType,
  ): Promise<boolean> {
    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const connection = transactionalEntityManager.connection;
        const queryRunner = connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          return this.saveAccountToDB(queryRunner, accountId, balance, type);
        } catch (err) {
          await queryRunner.rollbackTransaction();
          console.error(err);
          return false;
        } finally {
          await queryRunner.release();
        }
      },
    );
  }

  async getAccountFromDB(
    queryRunner: QueryRunner,
    accountId: number,
  ): Promise<Account> {
    const accountSnapshot = await queryRunner.manager.findOne(Account, {
      where: { id: accountId },
    });

    if (!accountSnapshot) {
      throw new AccountNotFoundException();
    }

    return accountSnapshot;
  }

  async saveAccountToDB(
    queryRunner: QueryRunner,
    accountId: number,
    balance: number,
    type: TransactionType,
  ): Promise<boolean> {
    const accountSnapshot = await this.getAccountFromDB(queryRunner, accountId);

    let newBalance = 0;
    if (
      type === TransactionType.TRANSFER ||
      type === TransactionType.WITHDRAWAL
    ) {
      if (accountSnapshot.balance < balance) {
        throw new InsufficientFundsException();
      } else {
        newBalance = accountSnapshot.balance -= balance;
      }
    } else if (
      type === TransactionType.TOP_UP ||
      type === TransactionType.RECEIVE
    ) {
      newBalance = accountSnapshot.balance += balance;
    } else {
      throw new ForbiddenException();
    }

    const updateResult = await queryRunner.manager
      .createQueryBuilder()
      .update(Account)
      .set({
        balance: newBalance,
        lastUpdated: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :id AND lastUpdated = :lastUpdated', {
        id: accountId,
        lastUpdated: accountSnapshot.lastUpdated,
      })
      .execute();

    if (updateResult.affected === 0) {
      throw new Error('Failed to update due to concurrent modification');
    }

    const transaction = this.createTransaction(
      accountSnapshot.iban,
      balance,
      type,
    );
    queryRunner.manager.getRepository(Transaction).create(transaction);
    await queryRunner.commitTransaction();

    return true;
  }

  createTransaction(iban: string, amount: number, type: TransactionType) {
    const transaction = new Transaction();
    transaction.amount = amount;
    transaction.iban = iban;
    transaction.type = type;
    return transaction;
  }
}
