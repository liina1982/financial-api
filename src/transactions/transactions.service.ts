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
  ): Promise<Account | Observable<never>> {
    return await this.updateAccountBalance(id, amount, type);
  }

  async processWithdraw(
    type: TransactionType,
    accountId: number,
    amount: number,
  ): Promise<Account | Observable<never>> {
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

          await this.updateAccountBalanceWithExistingConnection(
            queryRunner,
            senderAccount.id,
            transferDto.amount,
            TransactionType.TRANSFER,
          );

          await this.updateAccountBalanceWithExistingConnection(
            queryRunner,
            receiverAccount.id,
            transferDto.amount,
            TransactionType.RECEIVE,
          );

          const senderTransaction = this.createTransaction(
            senderAccount.iban,
            transferDto.amount * 100,
            TransactionType.TRANSFER,
          );
          await transactionalEntityManager
            .getRepository(Transaction)
            .save(senderTransaction);

          const receiverTransaction = this.createTransaction(
            receiverAccount.iban,
            transferDto.amount * 100,
            TransactionType.RECEIVE,
          );
          await transactionalEntityManager
            .getRepository(Transaction)
            .save(receiverTransaction);
            
            const updatedReceiverAccount = await this.getAccountFromDB(
              queryRunner,
              transferDto.receiverAccountId,
            );
            
            const updatedSenderAccount = await this.getAccountFromDB(
              queryRunner,
              transferDto.senderAccountId,
            );

          await queryRunner.commitTransaction();

          return {
            senderBalance: updatedSenderAccount.balance / 100,
            receiverBalance: updatedReceiverAccount.balance / 100,
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

  async updateAccountBalance(
    accountId: number,
    amount: number,
    type: TransactionType,
  ): Promise<Account | Observable<never>> {
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
          const account = await this.getAccountFromDB(queryRunner, accountId)
          await queryRunner.commitTransaction();
          account.balance = account.balance / 100;
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

  async updateAccountBalanceWithExistingConnection(
    queryRunner: QueryRunner,
    accountId: number,
    amount: number,
    type: TransactionType,
  ): Promise<boolean> {
      return await this.saveAccountToDB(
        queryRunner,
        accountId,
        amount,
        type,
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
