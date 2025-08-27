import 'dotenv/config';
import { AppDataSource } from '../src/config/database';

async function runMigrations() {
  try {
    await AppDataSource.initialize();
    console.log('Running migrations...');
    
    const migrations = await AppDataSource.runMigrations();
    
    if (migrations.length === 0) {
      console.log('No migrations to run');
    } else {
      console.log(`Successfully ran ${migrations.length} migration(s):`);
      migrations.forEach(migration => {
        console.log(`  - ${migration.name}`);
      });
    }
    
    await AppDataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  }
}

runMigrations();