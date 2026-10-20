import { Router } from 'express';
import storeRoutes from './store.routes';
import chatRoutes from './chat.routes';
import enquiryRoutes from './enquiry.routes';
import announcementRoutes from './announcement.routes';
import uploadRoutes from './upload.routes';

const router = Router();

// Health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Dukan Bari Hyperlocal API & Real-Time Engine'
  });
});

router.use('/stores', storeRoutes);
router.use('/chat', chatRoutes);
router.use('/enquiries', enquiryRoutes);
router.use('/announcements', announcementRoutes);
router.use('/upload', uploadRoutes);

export default router;
