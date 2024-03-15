import { ForbiddenException, Injectable } from '@nestjs/common';
import { Transaction } from './transactions.entity';
import { EntityManager, QueryRunner } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { TransactionType } from '../transactions/transactions.entity';
import { TransferDto } from './dtos/TransferDto';
import { InsufficientFundsException } from 'src/exceptions/insufficient-funds.exception';
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
    return await this.updateAccountBalance(id, amount, type);
  }

  async processWithdraw(
    type: TransactionType,
    accountId: number,
    amount: number,
  ): Promise<boolean> {
    return await this.updateAccountBalance(accountId, amount, type);
  }

  async processTransfer(transferDto: TransferDto): Promise<
    | {
        senderBalance: number;
        receiverBalance: number;
      }
    | boolean
    | Observable<never>
  > {
    const amountInCents = transferDto.amount * 100;
    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const connection = transactionalEntityManager.connection;
        const queryRunner = connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
          const receiverAccount = await this.getAccountFromDB(
            queryRunner,
            transferDto.receiverAccountId,
          );

          const senderAccount = await this.getAccountFromDB(
            queryRunner,
            transferDto.senderAccountId,
          );

          if (senderAccount.balance < amountInCents) {
            throw new InsufficientFundsException();
          }

          senderAccount.balance -= amountInCents;
          receiverAccount.balance += amountInCents;

          await this.updateAccountBalanceWithExistingConnection(
            queryRunner,
            senderAccount.userId,
            senderAccount.balance,
            TransactionType.TRANSFER,
          );

          await this.updateAccountBalanceWithExistingConnection(
            queryRunner,
            receiverAccount.userId,
            receiverAccount.balance,
            TransactionType.RECEIVE,
          );

          const senderTransaction = this.createTransaction(
            senderAccount.iban,
            amountInCents,
            TransactionType.TRANSFER,
          );
          await transactionalEntityManager
            .getRepository(Transaction)
            .save(senderTransaction);

          const receiverTransaction = this.createTransaction(
            receiverAccount.iban,
            amountInCents,
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
      },
    );
  }

  async updateAccountBalances(
    accountId: number,
    balance: number,
    type: TransactionType,
  ): Promise<Account | boolean | Observable<never>> {
    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const connection = transactionalEntityManager.connection;
        const queryRunner = connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const account = await this.saveAccountToDB(queryRunner, accountId, balance, type);
          queryRunner.commitTransaction();
          return account;
        } catch (error) {
          await queryRunner.rollbackTransaction();
          console.error(error);
          return throwError(() => error);
        } finally {
          await queryRunner.release();
        }
      },
    );
  }

  async updateAccountBalance(
    accountId: number,
    amount: number,
    type: TransactionType,
  ): Promise<boolean> {
    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const connection = transactionalEntityManager.connection;
        const queryRunner = connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          await this.saveAccountToDB(
            queryRunner,
            accountId,
            amount,
            type,
          );
          await queryRunner.commitTransaction();
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

  async updateAccountBalanceWithExistingConnection(
    queryRunner: QueryRunner,
    accountId: number,
    amount: number,
    type: TransactionType,
  ): Promise<boolean> {
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      return await this.saveAccountToDB(
        queryRunner,
        accountId,
        amount,
        type,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error(error);
      throwError(() => error);
    } finally {
      await queryRunner.release();
    }
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
    amount: number,
    type: TransactionType,
  ): Promise<boolean> {
    const accountSnapshot = await this.getAccountFromDB(queryRunner, accountId);

    const amountInCents = amount * 100;
    let newBalance = 0;
    if (
      type === TransactionType.TRANSFER ||
      type === TransactionType.WITHDRAWAL
    ) {
      if (accountSnapshot.balance < amountInCents) {
        throw new InsufficientFundsException();
      } else {
        newBalance = accountSnapshot.balance -= amountInCents;
      }
    } else if (
      type === TransactionType.TOP_UP ||
      type === TransactionType.RECEIVE
    ) {
      newBalance = accountSnapshot.balance += amountInCents;
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
      amountInCents,
      type,
    );

    await queryRunner.manager.getRepository(Transaction).save(transaction);
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
