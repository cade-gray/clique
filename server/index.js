import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store, HttpError } from './store.js';
import { parsePlannerWorkbook, plannerTargets, importPlannerTasks } from './planner.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// A relative DATA_DIR is resolved from the app folder, not the process working directory,
// so it means the same thing under IIS, a service manager, or a terminal.
const store = new Store(path.resolve(root, process.env.DATA_DIR || 'data'));

const app = express();
app.use(express.json({ limit: '5mb' }));

const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).then((r) => res.json(r ?? { ok: true }), next);
const api = express.Router();
// Requests without a JSON body get an empty object, so handlers answer 400 rather than crash.
api.use((req, res, next) => {
  req.body ??= {};
  next();
});

api.get('/workspace', h(() => store.getWorkspace()));
api.put('/workspace', h((req) => store.saveWorkspace(req.body)));

api.get('/projects', h((req) => store.listProjects({ withSubtasks: req.query.include === 'subtasks' })));
api.post('/projects', h((req) => store.createProject(req.body)));
api.get('/projects/:id', h((req) => store.getProject(req.params.id)));
api.patch('/projects/:id', h((req) => store.updateProject(req.params.id, req.body)));
api.post('/projects/:id/updates', h((req) => store.addUpdate(req.params.id, req.body ?? {})));
api.delete('/projects/:id/updates/:uid', h((req) => store.deleteUpdate(req.params.id, req.params.uid)));
api.delete('/projects/:id', h((req) => store.deleteProject(req.params.id)));
api.post('/board/reorder', h((req) => store.reorderColumn(req.body.status, req.body.ids ?? [])));

// Images arrive as the raw request body with their own Content-Type; ?name= is the original file name.
api.post(
  '/projects/:id/attachments',
  express.raw({ type: 'image/*', limit: '20mb' }),
  h((req) =>
    store.saveAttachment(req.params.id, {
      name: req.query.name,
      type: req.get('Content-Type')?.split(';')[0].trim().toLowerCase(),
      data: req.body,
    }),
  ),
);
api.get('/projects/:id/attachments/:file', (req, res, next) => {
  let file;
  try {
    file = store.attachmentFile(req.params.id, req.params.file);
  } catch (err) {
    return next(err);
  }
  // File names are unique per upload, so the browser can keep them for a long time.
  res.sendFile(file, { maxAge: '30d', headers: { 'X-Content-Type-Options': 'nosniff' } }, (err) => {
    if (err) next(err.status === 404 ? new HttpError(404, 'Not found') : err);
  });
});

// Planner import is two steps: upload the exported workbook to see what's in it (nothing is saved),
// then send back the tasks with a board column chosen for each bucket.
api.post(
  '/import/planner/preview',
  express.raw({ type: () => true, limit: '20mb' }),
  h(async (req) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw new HttpError(400, 'Choose the exported .xlsx file');
    const preview = parsePlannerWorkbook(req.body);
    // Which properties assignees, due dates and priorities will land in, so the page can say so.
    const targets = Object.fromEntries(Object.entries(plannerTargets(await store.getWorkspace())).map(([k, p]) => [k, p?.name ?? null]));
    return { ...preview, targets };
  }),
);
api.post('/import/planner', h((req) => importPlannerTasks(store, req.body.tasks, req.body.buckets)));

api.post('/projects/:id/pages', h((req) => store.createPage(req.params.id, req.body)));
api.get('/projects/:id/pages/:page', h((req) => store.getPage(req.params.id, req.params.page)));
api.patch('/projects/:id/pages/:page', h((req) => store.updatePage(req.params.id, req.params.page, req.body)));
api.delete('/projects/:id/pages/:page', h((req) => store.deletePage(req.params.id, req.params.page)));

api.use((req, res) => res.status(404).json({ error: 'Not found' }));
api.use((err, req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, ...err.extra });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That file is too large' });
  console.error(err);
  if (['EACCES', 'EPERM'].includes(err.code))
    return res.status(500).json({ error: 'The server cannot write to its data folder. Check the folder permissions.' });
  res.status(500).json({ error: 'Internal error' });
});

// BASE_PATH is the IIS virtual directory (e.g. /clique) when not hosted at the site root.
const base = (process.env.BASE_PATH || '').replace(/\/+$/, '');
app.use(`${base}/api`, api);
app.use(base || '/', express.static(path.join(root, 'dist')));

// Under IIS, HttpPlatformHandler passes the port in HTTP_PLATFORM_PORT.
const port = process.env.HTTP_PLATFORM_PORT || process.env.PORT || 3001;
// Startup problems go to the log in plain words (under IIS that is logs\node.log).
store.init().then(
  () => {
    app.listen(port, (err) => {
      if (err) {
        console.error(`Clique could not listen on port ${port}: ${err.message}`);
        process.exit(1);
      }
      console.log(`Clique listening on ${port}, data in ${store.dir}`);
    });
  },
  (err) => {
    console.error(`Clique could not open its data folder ${store.dir}: ${err.message}`);
    console.error('Check that DATA_DIR is correct and that the account running Clique has modify rights on it.');
    process.exit(1);
  },
);
