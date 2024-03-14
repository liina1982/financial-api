import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  AfterInsert,
  CreateDateColumn,
} from 'typeorm';
import { IsIBAN, IsNotEmpty, IsNumber } from 'class-validator';
import { CreateAccountDto } from './dtos/CreateAccountDto';
import { LoggerService } from '../shared/logger.service';

@Entity()
export class Account {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @Column()
  @IsIBAN()
  iban: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @CreateDateColumn()
  createdAt: Date;

  constructor(partial: Partial<CreateAccountDto>) {
    Object.assign(this, partial);
    this.balance = this.balance || 0;
  }

  @AfterInsert()
  async logUpdate() {
    const data = {
      userId: this.userId,
      iban: this.iban,
      createddAt: this.createdAt,
    };
    const entityId = this.id;
    const entityName = 'Account';

    LoggerService.logEntityCreate(entityName, entityId, data);
  }
}
