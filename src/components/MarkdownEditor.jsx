import { useEffect, useRef } from 'react';
import { Crepe } from '@milkdown/crepe';
import { remarkStringifyOptionsCtx } from '@milkdown/kit/core';
import '@milkdown/crepe/theme/common/style.css';
import '@milkdown/crepe/theme/frame.css';

// Notion-style live markdown editor (Milkdown Crepe): markdown renders as you type,
// "/" opens the block menu, and code blocks get syntax highlighting and a Copy button.
// The editor is uncontrolled: remount it (change `key`) to load different content.
// `uploadImage(file)` stores a pasted/dropped/picked image and resolves to the src to write in the
// markdown; `resolveImage(src)` maps that src to a URL the browser can load. Both are read once at mount.
export default function MarkdownEditor({ value, onChange, uploadImage, resolveImage, placeholder = "Type '/' for commands" }) {
  const rootRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let crepe = new Crepe({
      root: rootRef.current,
      defaultValue: value ?? '',
      featureConfigs: {
        [Crepe.Feature.Placeholder]: { text: placeholder, mode: 'doc' },
        // Without onUpload, Crepe inserts a temporary blob: URL that is gone once the browser closes.
        [Crepe.Feature.ImageBlock]: {
          onUpload: uploadImage
            ? (file) =>
                uploadImage(file).catch((err) => {
                  window.alert(`The image could not be uploaded: ${err.message}`);
                  throw err;
                })
            : undefined,
          proxyDomURL: resolveImage,
        },
      },
    });
    // Write "-" bullets like Obsidian does instead of remark's default "*".
    crepe.editor.config((ctx) => {
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({ ...prev, bullet: '-' }));
    });
    let ready = false;
    crepe.on((listener) => {
      listener.markdownUpdated((_ctx, markdown, prev) => {
        // Ignore the normalisation pass Crepe does while loading the initial document.
        if (ready && markdown !== prev) onChangeRef.current?.(markdown);
      });
    });
    const created = crepe.create().then(() => {
      ready = true;
    });
    return () => {
      const c = crepe;
      crepe = null;
      created.then(() => c.destroy());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="md-editor" ref={rootRef} />;
}
