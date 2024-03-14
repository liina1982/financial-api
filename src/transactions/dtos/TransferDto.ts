import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsNotEmpty, IsPositive } from 'class-validator';

export class TransferDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  senderAccountId: number;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  receiverAccountId: number;
}
