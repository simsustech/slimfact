import { sql } from 'kysely'

export const convertImageSql = sql<string>`case when image is not null then concat('data:image/png;base64,', encode(image, 'base64')) end`
