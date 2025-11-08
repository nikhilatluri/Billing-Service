const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const axios = require('axios');

const TAX_RATE = parseFloat(process.env.TAX_RATE) || 0.05;
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007';

class BillController {
  // Send notification
  async sendNotification(type, patientId, data) {
    try {
      await axios.post(`${NOTIFICATION_SERVICE_URL}/v1/notifications`, {
        type,
        patient_id: patientId,
        message: data.message,
        metadata: data
      });
    } catch (error) {
      logger.warn('Failed to send notification', { error: error.message, type });
    }
  }

  async generateBill(req, res, next) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { appointment_id, patient_id, doctor_id, amount, bill_type = 'CONSULTATION' } = req.body;

      // Check if bill already exists for this appointment
      const existing = await client.query(
        'SELECT * FROM bills WHERE appointment_id = $1',
        [appointment_id]
      );

      if (existing.rows.length > 0) {
        throw new AppError('Bill already exists for this appointment', 409, 'DUPLICATE_BILL');
      }

      // Calculate tax and total
      const taxAmount = amount * TAX_RATE;
      const totalAmount = amount + taxAmount;

      // Create bill
      const result = await client.query(
        `INSERT INTO bills (appointment_id, patient_id, doctor_id, amount, tax_amount, total_amount, status, bill_type)
         VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7)
         RETURNING *`,
        [appointment_id, patient_id, doctor_id, amount, taxAmount, totalAmount, bill_type]
      );

      const bill = result.rows[0];

      await client.query('COMMIT');

      // Send notification
      this.sendNotification('BILL_GENERATED', patient_id, {
        message: `Bill generated for appointment ${appointment_id}. Total amount: $${totalAmount.toFixed(2)}`,
        billId: bill.bill_id,
        appointmentId: appointment_id,
        amount: totalAmount
      });

      logger.info('Bill generated', {
        correlationId: req.correlationId,
        billId: bill.bill_id,
        appointmentId: appointment_id,
        totalAmount
      });

      res.status(201).json({
        success: true,
        data: bill,
        correlationId: req.correlationId
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  async handleCancellation(req, res, next) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { appointment_id, refund_policy } = req.body;

      // Get existing bill
      const result = await client.query(
        'SELECT * FROM bills WHERE appointment_id = $1',
        [appointment_id]
      );

      if (result.rows.length === 0) {
        // No bill exists yet, just record the refund policy
        logger.info('No bill found for cancelled appointment', {
          correlationId: req.correlationId,
          appointmentId: appointment_id,
          refundPolicy: refund_policy
        });

        await client.query('COMMIT');

        return res.json({
          success: true,
          message: 'Cancellation recorded, no bill to process',
          refundPolicy: refund_policy,
          correlationId: req.correlationId
        });
      }

      const bill = result.rows[0];

      if (bill.status === 'PAID') {
        // Handle refund for paid bills
        let refundAmount = 0;
        let newStatus = 'REFUND';

        switch (refund_policy) {
          case 'FULL_REFUND':
            refundAmount = bill.total_amount;
            break;
          case 'PARTIAL_REFUND':
            refundAmount = bill.total_amount * 0.5; // 50% refund
            break;
          case 'CANCELLATION_FEE':
            refundAmount = 0;
            newStatus = 'VOID'; // No refund, apply cancellation fee
            break;
          default:
            refundAmount = 0;
            newStatus = 'VOID';
        }

        const updateResult = await client.query(
          `UPDATE bills
           SET status = $1, refund_policy = $2, updated_at = CURRENT_TIMESTAMP
           WHERE bill_id = $3
           RETURNING *`,
          [newStatus, refund_policy, bill.bill_id]
        );

        await client.query('COMMIT');

        logger.info('Bill refund processed', {
          correlationId: req.correlationId,
          billId: bill.bill_id,
          refundAmount,
          refundPolicy: refund_policy
        });

        res.json({
          success: true,
          data: updateResult.rows[0],
          refundAmount,
          correlationId: req.correlationId
        });
      } else {
        // Bill not paid yet, just void it
        const updateResult = await client.query(
          `UPDATE bills
           SET status = 'VOID', refund_policy = $1, updated_at = CURRENT_TIMESTAMP
           WHERE bill_id = $2
           RETURNING *`,
          [refund_policy, bill.bill_id]
        );

        await client.query('COMMIT');

        logger.info('Unpaid bill voided', {
          correlationId: req.correlationId,
          billId: bill.bill_id
        });

        res.json({
          success: true,
          data: updateResult.rows[0],
          correlationId: req.correlationId
        });
      }
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  async markBillPaid(req, res, next) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { id } = req.params;
      const { payment_id } = req.body;

      // Get bill
      const result = await client.query(
        'SELECT * FROM bills WHERE bill_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Bill not found', 404, 'BILL_NOT_FOUND');
      }

      const bill = result.rows[0];

      if (bill.status === 'PAID') {
        throw new AppError('Bill already paid', 400, 'ALREADY_PAID');
      }

      if (bill.status === 'VOID') {
        throw new AppError('Cannot pay voided bill', 400, 'BILL_VOIDED');
      }

      // Update status
      const updateResult = await client.query(
        `UPDATE bills
         SET status = 'PAID', updated_at = CURRENT_TIMESTAMP
         WHERE bill_id = $1
         RETURNING *`,
        [id]
      );

      await client.query('COMMIT');

      logger.info('Bill marked as paid', {
        correlationId: req.correlationId,
        billId: id,
        paymentId: payment_id
      });

      res.json({
        success: true,
        data: updateResult.rows[0],
        correlationId: req.correlationId
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }

  async getBill(req, res, next) {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'SELECT * FROM bills WHERE bill_id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Bill not found', 404, 'BILL_NOT_FOUND');
      }

      res.json({
        success: true,
        data: result.rows[0],
        correlationId: req.correlationId
      });
    } catch (error) {
      next(error);
    }
  }

  async getBillByAppointment(req, res, next) {
    try {
      const { appointment_id } = req.params;

      const result = await pool.query(
        'SELECT * FROM bills WHERE appointment_id = $1',
        [appointment_id]
      );

      if (result.rows.length === 0) {
        throw new AppError('Bill not found for this appointment', 404, 'BILL_NOT_FOUND');
      }

      res.json({
        success: true,
        data: result.rows[0],
        correlationId: req.correlationId
      });
    } catch (error) {
      next(error);
    }
  }

  async getBills(req, res, next) {
    try {
      const { patient_id, status, page = 1, limit = 10 } = req.query;

      const conditions = [];
      const values = [];
      let paramCount = 0;

      if (patient_id) {
        paramCount++;
        conditions.push(`patient_id = $${paramCount}`);
        values.push(patient_id);
      }

      if (status) {
        paramCount++;
        conditions.push(`status = $${paramCount}`);
        values.push(status);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await pool.query(
        `SELECT COUNT(*) FROM bills ${whereClause}`,
        values
      );
      const totalCount = parseInt(countResult.rows[0].count);

      // Get paginated results
      const result = await pool.query(
        `SELECT * FROM bills ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`,
        [...values, limit, offset]
      );

      res.json({
        success: true,
        data: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalCount,
          totalPages: Math.ceil(totalCount / limit)
        },
        correlationId: req.correlationId
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BillController();
