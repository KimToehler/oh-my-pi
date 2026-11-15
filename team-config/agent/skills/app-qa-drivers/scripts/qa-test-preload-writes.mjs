// Test-only preload (node --import) for qa.test.mjs: wraps every node:fs write entry point (sync, callback, promise and
// stream) and logs each written chunk as a JSON line {fn, path, text} to QA_TEST_WRITE_LOG, so a test can prove that
// no chunk holds a value (task 3.1, memory-only build output). The log itself is written with the original function.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const logPath = process.env.QA_TEST_WRITE_LOG;
const append = fs.appendFileSync;
const record = (fn, path, data, encoding) => {
  const text = typeof data === 'string' ? data : Buffer.from(data.buffer ?? data, data.byteOffset, data.byteLength).toString('latin1');
  append(logPath, `${JSON.stringify({ fn, path: String(path), text, encoding: encoding ?? null })}\n`);
};
const origin = (fd) => (typeof fd === 'number' ? `fd:${fd}` : String(fd));

for (const fn of ['writeFileSync', 'appendFileSync']) {
  const original = fs[fn];
  fs[fn] = function wrapped(path, data, ...rest) {
    if (path !== logPath) record(fn, origin(path), data);
    return original.call(this, path, data, ...rest);
  };
}
for (const fn of ['writeFile', 'appendFile']) {
  const original = fs[fn];
  fs[fn] = function wrapped(path, data, ...rest) {
    record(fn, origin(path), data);
    return original.call(this, path, data, ...rest);
  };
  const promised = fs.promises[fn];
  fs.promises[fn] = function wrapped(path, data, ...rest) {
    record(`promises.${fn}`, origin(path), data);
    return promised.call(this, path, data, ...rest);
  };
}
for (const fn of ['writeSync', 'write']) {
  const original = fs[fn];
  fs[fn] = function wrapped(fd, data, ...rest) {
    if (fd > 2 || fd < 0) record(fn, origin(fd), data);
    return original.call(this, fd, data, ...rest);
  };
}
const createWriteStream = fs.createWriteStream;
fs.createWriteStream = function wrapped(path, ...rest) {
  const stream = createWriteStream.call(this, path, ...rest);
  const write = stream.write;
  stream.write = function wrappedWrite(chunk, ...args) {
    record('createWriteStream', origin(path), chunk);
    return write.call(this, chunk, ...args);
  };
  const end = stream.end;
  stream.end = function wrappedEnd(chunk, ...args) {
    if (chunk && typeof chunk !== 'function') record('createWriteStream', origin(path), chunk);
    return end.call(this, chunk, ...args);
  };
  return stream;
};
const open = fs.promises.open;
fs.promises.open = async function wrapped(path, ...rest) {
  const handle = await open.call(this, path, ...rest);
  for (const fn of ['write', 'writeFile', 'appendFile']) {
    const original = handle[fn];
    handle[fn] = function wrappedHandle(data, ...args) {
      record(`filehandle.${fn}`, origin(path), data);
      return original.call(this, data, ...args);
    };
  }
  return handle;
};
syncBuiltinESMExports();
