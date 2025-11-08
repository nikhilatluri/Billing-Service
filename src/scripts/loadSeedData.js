require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

const loadSeedData = async () => {
  const client = await pool.connect();
  try {
    logger.info('Loading seed data for bills...');
    const csvPath = path.join(__dirname, '../../../shared/seed-data/hms_bills.csv');
    if (!fs.existsSync(csvPath)) {
      logger.warn('Seed data file not found, skipping');
      return;
    }
    const csvData = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvData.trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const [bill_id, appointment_id, patient_id, doctor_id, amount, tax_amount, total_amount, status, created_at] = lines[i].split(',');
      await client.query(
        `INSERT INTO bills (bill_id, appointment_id, patient_id, doctor_id, amount, tax_amount, total_amount, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
        [bill_id, appointment_id, patient_id, doctor_id, amount, tax_amount, total_amount, status, created_at]
      );
    }
    logger.info(`Loaded ${lines.length - 1} bills from seed data`);
  } catch (error) {
    logger.error('Failed to load seed data', { error: error.message });
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

loadSeedData()
  .then(() => { logger.info('Seed data loaded successfully'); process.exit(0); })
  .catch(() => { process.exit(1); });
