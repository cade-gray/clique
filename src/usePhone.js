import { useSyncExternalStore } from 'react';

// Keep in step with the phone @media rule at the end of styles.css. The second half catches a
// phone held sideways, which is wider than 760px but still a small touch screen.
const mq = window.matchMedia('(max-width: 760px), (max-height: 500px) and (pointer: coarse)');

function subscribe(onChange) {
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

export function usePhone() {
  return useSyncExternalStore(subscribe, () => mq.matches);
}
