import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function saveReservationToFile(data) {
  const filePath = path.join(__dirname, '..', 'data', 'reservations.json');

  if (!fs.existsSync(path.dirname(filePath))) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  let reservations = [];
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      reservations = JSON.parse(fileContent);
      if (!Array.isArray(reservations)) {
        reservations = [reservations];
      }
    } catch (err) {
      reservations = [];
    }
  }

  reservations.push(data);
  fs.writeFileSync(filePath, JSON.stringify(reservations, null, 2));
}

export { saveReservationToFile };
