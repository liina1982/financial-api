import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Validate } from 'class-validator';
import { IsIbanAlreadyExist } from '../IsIbanAlreadyExsist';
import { IbanFormatValidator } from 'src/validators/IbanFormatValidator';

export class CreateAccountDto {
  @ApiProperty()
  @IsNotEmpty()
  userId: number;

  @ApiProperty()
  @IsNotEmpty()
  @Validate(IsIbanAlreadyExist, ['iban'], {
    message: 'Iban already exsists',
  })
  @Validate(IbanFormatValidator, ['iban'], {
    message: 'Please enter iban in correct format',
  })
  iban: string;
}
