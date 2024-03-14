import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AccountsService } from './accounts.service';
import { Injectable } from '@nestjs/common';

@ValidatorConstraint({ name: 'isIbanAlreadyExist', async: true })
@Injectable()
export class IsIbanAlreadyExist implements ValidatorConstraintInterface {
  constructor(protected readonly accountsService: AccountsService) {}

  async validate(iban: string) {
    const user = await this.accountsService.findIban(iban);
    return !user;
  }
}
