export function createFrameLog() {
  const inbox = [];
  const history = [];
  return {
    inbox,
    history,
    record(value) {
      const frame = String(value);
      inbox.push(frame);
      history.push(frame);
    },
  };
}

export function isChatFrame(frame, content) {
  if (!/^MESSAGE\r?\n/.test(frame) || !frame.endsWith('\0')) return false;
  const separator = /\r?\n\r?\n/.exec(frame);
  if (!separator) return false;
  try {
    const body = frame.slice(separator.index + separator[0].length, -1);
    return JSON.parse(body)?.content === content;
  } catch {
    return false;
  }
}
