import { Injectable } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'IbanValidation', async: false })
@Injectable()
export class IbanFormatValidator implements ValidatorConstraintInterface {
  validate(value: any) {
    if (typeof value !== 'string') {
      return false;
    }

    // IBAN format validation logic
    // Implement the IBAN validation algorithm here
    // Example: Basic IBAN format check
    const ibanRegex = /^[A-Z]{2}\d{2}[A-Z\d]{4}\d{7}([A-Z\d]?){0,16}$/;
    return ibanRegex.test(value);
  }

  defaultMessage() {
    return 'Invalid IBAN format';
  }
}
