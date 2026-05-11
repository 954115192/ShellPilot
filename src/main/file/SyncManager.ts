import * as chokidar from 'chokidar'

export class SyncManager {
  private watcher: any
  private interval: number

  constructor(interval: number = 1000) {
    this.interval = interval
  }

  watch(path: string, callback: (event: string, path: string) => void): void {
    this.watcher = chokidar.watch(path, {
      ignored: /(^|\/)\./,
      persistent: true,
      awaitWriteFinish: true
    })

    this.watcher.on('all', (event: string, path: string) => {
      callback(event, path)
    })
  }

  unwatch(): void {
    if (this.watcher) {
      this.watcher.close()
    }
  }

  clearInterval(): void {
    clearInterval(this.interval)
  }
}
