import { Router, static as serveStatic } from 'express';
import swaggerUi from 'swagger-ui-dist';
import { fileURLToPath } from 'node:url';
import { openapi } from '../docs/openapi.js';

const router = Router({ strict: true });
const uiFolder = fileURLToPath(new URL('../docs/ui/', import.meta.url));
router.get('/openapi.json', (req, res) => res.json(openapi));
router.get('/docs', (req, res) => res.redirect(302, '/api/docs/'));
router.get('/docs/', (req, res) => res.sendFile('index.html', { root: uiFolder }));
router.use('/docs/assets', serveStatic(swaggerUi.getAbsoluteFSPath(), { index: false }));
router.use('/docs', serveStatic(uiFolder, { index: false, etag: false, maxAge: 0 }));
export default router;
