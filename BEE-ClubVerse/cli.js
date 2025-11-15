import fs from 'fs';
import path from 'path';

const command = process.argv[2]; 

const filePath = path.join(process.cwd(), 'data', 'reservations.json');

if (command === 'list') {
  if (!fs.existsSync(filePath)) {
    console.log('No reservations found.');
    process.exit(0);
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const reservations = JSON.parse(fileContent || '[]');

  if (reservations.length === 0) {
    console.log('No reservations found.');
  } else {
    console.log('📋 Reservations:\n--------------------------');
    reservations.forEach((r, i) => {
      console.log(`👤 Name: ${r.name}`);
      console.log(`📧 Email: ${r.email}`);
      console.log(`📅 Date: ${r.date}`);
      console.log(`🕒 Time: ${r.time}`);
      console.log(`👥 Guests: ${r.guests}`);
      console.log(`🏢 Club: ${r.club}`);
      console.log('--------------------------');
    });
  }
} else {
  console.log('❌ Invalid command. Use:');
  console.log('   node cli.js list');
}
