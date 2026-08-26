import * as path from 'path'
import { promises as fs } from 'fs'
import { Migrator, FileMigrationProvider } from 'kysely/migration'
import { db } from './index.js'

async function migrateToLatest() {
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: new URL('./migrations', import.meta.url).pathname
    }),
    // The banking-api proxy now shares this database (its tables live in the
    // open_banking schema, including its own kysely_migration). Without an
    // explicit schema the Migrator's table-exists introspection matches those
    // tables by name and skips creating the public migration table. Pin the
    // migration bookkeeping to public explicitly.
    migrationTableSchema: 'public'
  })

  const { error, results } = await migrator.migrateToLatest()

  if (!results?.length) console.log('No migrations to execute.')

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`migration "${it.migrationName}" was executed successfully`)
    } else if (it.status === 'Error') {
      console.error(`failed to execute migration "${it.migrationName}"`)
    }
  })

  if (error) {
    console.error('failed to migrate')
    console.error(error)
    process.exit(1)
  }

  await db.destroy()
}

migrateToLatest()
