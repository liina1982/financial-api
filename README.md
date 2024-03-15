# financial-API

## Description

This is test assignment and it's requirements are:
"The task is to implement an API to top-up account balance, withdraw money and transfer money from one account to another, using NodeJS, NestJS, Typeorm and any relational database you prefer. Things to consider: - money should have 2 decimal points, like 130.45 - account balance cannot go below 0; - API should work correctly with concurrent requests; has context menu"

## Installation

```bash
npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Using application

The service can be used through a Swagger URL. Prior to initiating any transactions, it is necessary to set up an account. You will be able to interact with endpoints for depositing, transferring and withdrawing funds.

swagger - <http://localhost:3000/api>


*  There are validations added for iban. You have to enter a correct iban when creating an account.
* Account balance is saved in in cents




## Tests

Currently there are no tests present.