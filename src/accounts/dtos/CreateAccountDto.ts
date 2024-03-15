import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Validate } from 'class-validator';
import { UniqueIbanValidator } from '../../validators/UniqueIbanValidator';
import { IbanFormatValidator } from '../../validators/IbanFormatValidator';

export class CreateAccountDto {
  @ApiProperty()
  @IsNotEmpty()
  userId: number;

  @ApiProperty()
  @IsNotEmpty()
  @Validate(UniqueIbanValidator, ['iban'], {
    message: 'Iban already exsists',
  })
  @Validate(IbanFormatValidator, ['iban'], {
    message: 'Please enter iban in correct format',
  })
  iban: string;
}
