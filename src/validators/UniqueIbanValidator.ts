import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AccountsService } from '../accounts/accounts.service';
import { Injectable } from '@nestjs/common';

@ValidatorConstraint({ name: 'UniqueIbanValidator', async: true })
@Injectable()
export class UniqueIbanValidator implements ValidatorConstraintInterface {
  constructor(protected readonly accountsService: AccountsService) {}

  async validate(iban: string): Promise<boolean> {
    const user = await this.accountsService.findIban(iban);
    return !user;
  }
}
