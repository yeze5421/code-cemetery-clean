/** Serializes writes so slow earlier requests cannot overwrite newer edits. */
export class SaveQueue<T> {
  private pending: Promise<unknown> = Promise.resolve();
  constructor(private readonly save: (snapshot: T) => Promise<unknown>) {}
  enqueue(snapshot: T): Promise<unknown> {
    const task = this.pending.then(() => this.save(snapshot));
    this.pending = task.catch(() => undefined);
    return task;
  }
}
