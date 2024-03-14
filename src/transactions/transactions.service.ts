import { ForbiddenException, Injectable } from '@nestjs/common';
import { Transaction } from './transactions.entity';
import { EntityManager } from 'typeorm';
import { Account } from '../accounts/account.entity';
import { TransactionType } from '../transactions/transactions.entity';
import { TransferDto } from './dtos/TransferDto';
import { InsufficientFundsException } from 'src/exceptions/insufficient-funds.exception';
import Decimal from 'decimal.js';
import { AccountNotFoundException } from 'src/exceptions/account-not-found.exception';

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

  async updateAccountBalance(
    accountId: number,
    balance: number,
    type: TransactionType,
  ): Promise<boolean> {
    //const connection = this.accountRepository.manager.connection;
    return await this.entityManager.transaction(
      async (transactionalEntityManager) => {
        const connection = transactionalEntityManager.connection;
        const queryRunner = connection.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const accountSnapshot = await queryRunner.manager.findOne(Account, {
            where: { id: accountId },
          });

          if (!accountSnapshot) {
            throw new AccountNotFoundException();
          }

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

          await queryRunner.commitTransaction();
          const transaction = this.createTransaction(
            accountSnapshot.iban,
            balance,
            type,
          );
          await transactionalEntityManager
            .getRepository(Transaction)
            .save(transaction);

          return true;
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

  createTransaction(iban: string, amount: number, type: TransactionType) {
    const transaction = new Transaction();
    transaction.amount = amount;
    transaction.iban = iban;
    transaction.type = type;
    return transaction;
  }
}
