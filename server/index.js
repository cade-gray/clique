import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, HttpError } from './store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const store = new Store(process.env.DATA_DIR || path.join(root, 'data'));

const app = express();
app.use(express.json({ limit: '5mb' }));

const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then((r) => res.json(r ?? { ok: true }), next);
const api = express.Router();

api.get('/workspace', h(() => store.getWorkspace()));
api.put('/workspace', h((req) => store.saveWorkspace(req.body)));

api.get('/projects', h(() => store.listProjects()));
api.post('/projects', h((req) => store.createProject(req.body)));
api.get('/projects/:id', h((req) => store.getProject(req.params.id)));
api.patch('/projects/:id', h((req) => store.updateProject(req.params.id, req.body)));
api.delete('/projects/:id', h((req) => store.deleteProject(req.params.id)));
api.post('/board/reorder', h((req) => store.reorderColumn(req.body.status, req.body.ids ?? [])));

api.post('/projects/:id/pages', h((req) => store.createPage(req.params.id, req.body)));
api.get('/projects/:id/pages/:page', h((req) => store.getPage(req.params.id, req.params.page)));
api.patch('/projects/:id/pages/:page', h((req) => store.updatePage(req.params.id, req.params.page, req.body)));
api.delete('/projects/:id/pages/:page', h((req) => store.deletePage(req.params.id, req.params.page)));

api.use((req, res) => res.status(404).json({ error: 'Not found' }));
api.use((err, req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

// BASE_PATH is the IIS virtual directory (e.g. /clique) when not hosted at the site root.
const base = (process.env.BASE_PATH || '').replace(/\/+$/, '');
app.use(`${base}/api`, api);
app.use(base || '/', express.static(path.join(root, 'dist')));

// Under IIS, HttpPlatformHandler passes the port in HTTP_PLATFORM_PORT.
const port = process.env.HTTP_PLATFORM_PORT || process.env.PORT || 3001;
store.init().then(() => {
  app.listen(port, () => console.log(`Clique listening on ${port}, data in ${store.dir}`));
});
