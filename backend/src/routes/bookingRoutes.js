import { Router } from 'express';
import { cancelarReserva, registrarReserva, seguirReserva } from '../controllers/bookingController.js';

const router = Router();

router.post('/bookings', registrarReserva);
router.get('/bookings/:id/tracking', seguirReserva);
router.post('/bookings/:id/cancel', cancelarReserva);

export default router;
