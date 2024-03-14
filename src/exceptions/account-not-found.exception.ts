import { HttpException, HttpStatus } from '@nestjs/common';

export class AccountNotFoundException extends HttpException {
  constructor() {
    super('Sender or receiver account not found', HttpStatus.NOT_FOUND);
  }
}
