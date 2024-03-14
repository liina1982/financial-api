import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, IsPositive } from 'class-validator';

export class TransactionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  accountId: number;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;
}
