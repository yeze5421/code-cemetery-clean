import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateCredential } from './policy';

export interface SecretStorage {
  available(): Promise<boolean>;
  encrypt(value: string): Promise<Buffer>;
  decrypt(value: Buffer): Promise<string>;
}
export class CredentialStore {
  private pending: Promise<void> = Promise.resolve();
  constructor(
    private filename: string,
    private storage: SecretStorage,
  ) {}
  async read() {
    await this.pending;
    let data: Buffer;
    try {
      data = await readFile(this.filename);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
      throw new Error('无法读取已保存的 GitHub 令牌。');
    }
    try {
      return validateCredential(await this.storage.decrypt(data));
    } catch {
      throw new Error('无法解密 GitHub 令牌，请重新保存。');
    }
  }
  async save(value: unknown) {
    const token = validateCredential(value);
    const task = this.pending.then(async () => {
      if (!token) {
        await unlink(this.filename).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
        return;
      }
      if (!(await this.storage.available())) throw new Error('系统加密不可用，无法保存令牌。');
      const encrypted = await this.storage.encrypt(token);
      await mkdir(path.dirname(this.filename), { recursive: true });
      const temporary = `${this.filename}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, encrypted, { mode: 0o600 });
        await rename(temporary, this.filename);
      } finally {
        await unlink(temporary).catch(() => undefined);
      }
    });
    this.pending = task.catch(() => undefined);
    await task;
    return Boolean(token);
  }
}
