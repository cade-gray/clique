import { useRef, useState } from 'react';
import Popover from './Popover.jsx';
import { downloadIcs, formatSlot, googleUrl, icsFilename, icsText, outlookUrl, subtaskEvent } from './calendar.js';
import { useTaskSummary } from './TaskLinks.jsx';

// Books time to work on a task. Clique hands the event to a calendar and keeps nothing: there is
// no way for it to know whether the block was kept, moved or deleted afterwards. `url` is the link
// the event carries back to Clique, and defaults to the page it was booked from.
export default function ScheduleButton({ text, projectId, doc, projectTitle, url = window.location.href }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  const summary = useTaskSummary(projectId, doc, open);
  return (
    <span className="schedule">
      <button
        ref={anchor}
        className="schedule-btn"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        title="Block time to work on this"
      >
        📅 Schedule
      </button>
      {open && summary !== null && (
        <ScheduleMenu
          anchor={anchor}
          event={subtaskEvent({ text, summary, projectTitle, url })}
          filename={icsFilename(text)}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function ScheduleMenu({ anchor, event, filename, onClose }) {
  return (
    <Popover title="Block time to work on this" anchor={anchor} onClose={onClose} className="schedule-menu">
      <div className="popover-label">Block time to work on this</div>
      <span className="popover-hint popover-note">
        {formatSlot(event.start, event.end)} — move it to a free slot once your calendar is open.
      </span>
      <a className="popover-item" href={googleUrl(event)} target="_blank" rel="noreferrer" onClick={onClose}>
        Google Calendar <span className="muted">↗</span>
      </a>
      <a className="popover-item" href={outlookUrl(event)} target="_blank" rel="noreferrer" onClick={onClose}>
        Outlook on the web <span className="muted">↗</span>
      </a>
      <button
        className="popover-item"
        onClick={() => {
          downloadIcs(filename, icsText(event));
          onClose();
        }}
      >
        Download .ics file
      </button>
    </Popover>
  );
}
