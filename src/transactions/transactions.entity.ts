import { IsNotEmpty, Validate } from 'class-validator';
import { LoggerService } from 'src/shared/logger.service';
import { IbanFormatValidator } from 'src/validators/IbanFormatValidator';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  AfterInsert,
} from 'typeorm';

export enum TransactionType {
  TOP_UP = 'top-up',
  WITHDRAWAL = 'withdraw',
  TRANSFER = 'transfer',
  RECEIVE = 'receive',
}

@Entity()
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Validate(IbanFormatValidator, ['iban'], {
    message: 'Please enter iban in correct format',
  })
  iban: string;

  @Column()
  @IsNotEmpty()
  type: TransactionType;

  @Column()
  @IsNotEmpty()
  amount: number;

  @CreateDateColumn()
  createdAt: Date;

  @AfterInsert()
  async logUpdate() {
    const data = {
      iban: this.iban,
      type: this.type,
      amount: this.amount,
      createddAt: this.createdAt,
    };
    const entityId = this.id;
    const entityName = 'Transaction';
    LoggerService.logEntityCreate(entityName, entityId, data);
  }
}
