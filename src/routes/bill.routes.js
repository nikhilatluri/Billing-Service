const express = require('express');
const router = express.Router();
const billController = require('../controllers/bill.controller');
const { validate } = require('../middleware/validator');

/**
 * @swagger
 * /v1/bills:
 *   post:
 *     summary: Generate a new bill
 *     tags: [Bills]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointment_id
 *               - patient_id
 *               - doctor_id
 *               - amount
 *             properties:
 *               appointment_id:
 *                 type: integer
 *               patient_id:
 *                 type: integer
 *               doctor_id:
 *                 type: integer
 *               amount:
 *                 type: number
 *                 format: float
 *               bill_type:
 *                 type: string
 *                 enum: [CONSULTATION, NO_SHOW_FEE, CANCELLATION_FEE]
 *     responses:
 *       201:
 *         description: Bill generated successfully
 *       409:
 *         description: Bill already exists
 */
router.post('/', validate('generateBill'), billController.generateBill);

/**
 * @swagger
 * /v1/bills/cancel:
 *   post:
 *     summary: Handle cancellation with refund policy
 *     tags: [Bills]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - appointment_id
 *               - refund_policy
 *             properties:
 *               appointment_id:
 *                 type: integer
 *               refund_policy:
 *                 type: string
 *                 enum: [FULL_REFUND, PARTIAL_REFUND, CANCELLATION_FEE, NO_REFUND]
 *     responses:
 *       200:
 *         description: Cancellation processed
 */
router.post('/cancel', validate('handleCancellation'), billController.handleCancellation);

/**
 * @swagger
 * /v1/bills:
 *   get:
 *     summary: Get bills with filters
 *     tags: [Bills]
 *     parameters:
 *       - in: query
 *         name: patient_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, PAID, VOID, REFUND]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of bills
 */
router.get('/', validate('searchQuery'), billController.getBills);

/**
 * @swagger
 * /v1/bills/{id}:
 *   get:
 *     summary: Get bill by ID
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bill details
 *       404:
 *         description: Bill not found
 */
router.get('/:id', billController.getBill);

/**
 * @swagger
 * /v1/bills/appointment/{appointment_id}:
 *   get:
 *     summary: Get bill by appointment ID
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: appointment_id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Bill details
 *       404:
 *         description: Bill not found
 */
router.get('/appointment/:appointment_id', billController.getBillByAppointment);

/**
 * @swagger
 * /v1/bills/{id}/pay:
 *   put:
 *     summary: Mark bill as paid
 *     tags: [Bills]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - payment_id
 *             properties:
 *               payment_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Bill marked as paid
 */
router.put('/:id/pay', validate('markPaid'), billController.markBillPaid);

module.exports = router;
