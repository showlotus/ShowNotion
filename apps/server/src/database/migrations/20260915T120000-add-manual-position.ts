import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('pages')
    .addColumn('manual_position', 'varchar')
    .execute();

  await sql`UPDATE pages SET manual_position = position`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('pages').dropColumn('manual_position').execute();
}
