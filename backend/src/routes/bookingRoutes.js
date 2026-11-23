import { Router } from 'express';
import { registrarReserva, seguirReserva } from '../controllers/bookingController.js';

const router = Router();

router.post('/bookings', registrarReserva);
router.get('/bookings/:id/tracking', seguirReserva);

export default router;
