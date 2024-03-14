import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  static logEntityCreate(
    entityName: string,
    entityId: number,
    createdFields: any,
  ) {
    console.log(
      `Entity ${entityName} with ID ${entityId} has been created. Data:`,
      createdFields,
    );
  }
}
