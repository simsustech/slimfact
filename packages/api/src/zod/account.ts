import * as z from 'zod'

export enum SLIMFACT_ACCOUNT_ROLES {
  ADMINISTRATOR = 'administrator',
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
  POINT_OF_SALE = 'pointofsale'
}

export const accountValidation = {
  id: z.number().optional(),
  name: z.string(),
  email: z.string(),
  verified: z.boolean(),
  customFields: z.unknown(),
  roles: z.array(z.nativeEnum(SLIMFACT_ACCOUNT_ROLES))
}

export const account = z.object(accountValidation)

export type Account = z.infer<typeof account>
