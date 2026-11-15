/**
 * CareCircle Hackathon Demo Seeder
 * Populates realistic demo dataset via backend demoSeed service
 */
import { seedDemoCircle } from '../backend/src/services/demoSeed.js';

process.env.TABLE_NAME = process.env.TABLE_NAME || 'carecircle-dev-table';
process.env.AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

async function run() {
  console.log('🌱 Seeding CareCircle Demo Dataset...\n');
  await seedDemoCircle({
    elderEmail: process.env.ELDER_EMAIL,
    caretakerEmail: process.env.CARETAKER_EMAIL,
    familyEmail: process.env.FAMILY_EMAIL,
  });
  console.log('\n✨ Demo Dataset Seeded Successfully!');
  console.log('----------------------------------------------------');
  console.log('Demo Circle: Kalyan Family Circle (demo-circle)');
  console.log(`Elder Login:     ${process.env.ELDER_EMAIL || 'shanti@demo.com'}  / shanti123`);
  console.log(`Caretaker Login: ${process.env.CARETAKER_EMAIL || 'rajesh@demo.com'}  / rajesh123`);
  console.log(`Family Login:    ${process.env.FAMILY_EMAIL || 'priya@demo.com'}   / priya123`);
  console.log('----------------------------------------------------');
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
