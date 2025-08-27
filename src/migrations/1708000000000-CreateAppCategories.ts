import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateAppCategories1708000000000 implements MigrationInterface {
  name = 'CreateAppCategories1708000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create app_categories table
    await queryRunner.createTable(
      new Table({
        name: 'app_categories',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'app_name',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'bundle_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'category',
            type: 'enum',
            enum: ['productive', 'neutral', 'distracting'],
            default: "'neutral'",
          },
          {
            name: 'organization_id',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'is_global',
            type: 'boolean',
            default: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['organization_id'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    // Add some default global categories
    await queryRunner.query(`
      INSERT INTO app_categories (app_name, bundle_id, category, is_global) VALUES
      ('Xcode', 'com.apple.dt.Xcode', 'productive', true),
      ('Terminal', 'com.apple.Terminal', 'productive', true),
      ('Visual Studio Code', 'com.microsoft.VSCode', 'productive', true),
      ('Sublime Text', 'com.sublimetext.4', 'productive', true),
      ('IntelliJ IDEA', NULL, 'productive', true),
      ('Notes', 'com.apple.Notes', 'productive', true),
      ('Pages', 'com.apple.iWork.Pages', 'productive', true),
      ('Numbers', 'com.apple.iWork.Numbers', 'productive', true),
      ('Keynote', 'com.apple.iWork.Keynote', 'productive', true),
      ('StudentTimeTracker', 'com.trilogy.StudentTimeTracker', 'productive', true),
      ('YouTube', NULL, 'distracting', true),
      ('Netflix', NULL, 'distracting', true),
      ('Twitter', NULL, 'distracting', true),
      ('Discord', NULL, 'distracting', true),
      ('Slack', 'com.tinyspeck.slackmacgap', 'neutral', true),
      ('Messages', 'com.apple.MobileSMS', 'distracting', true),
      ('WhatsApp', NULL, 'distracting', true),
      ('Safari', 'com.apple.Safari', 'neutral', true),
      ('Chrome', 'com.google.Chrome', 'neutral', true),
      ('Firefox', 'org.mozilla.firefox', 'neutral', true)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('app_categories');
  }
}