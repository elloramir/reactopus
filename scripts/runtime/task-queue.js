// Concurrency-limited task queue: N workers pull the next item as soon as
// they're free, instead of waiting for a whole batch to settle before
// starting newly-pushed items. A real reusable data structure (unlike the
// page-level loader/sandbox singletons), so it gets the same
// constructor+prototype shape as the parser. Items are URLs in every
// current use - typed concretely as `string` rather than a generic, since
// nothing else has ever been queued.
/**
 * @param {number} concurrency
 */
export default function TaskQueue(concurrency) {
    this.concurrency = concurrency;
    /**
     * @type {string[]}
     */
    this.items = [];
}

/**
 * @param {number} concurrency
 */
TaskQueue.prototype.setConcurrency = function (concurrency) {
    this.concurrency = concurrency;
};

/**
 * @param {string} item
 */
TaskQueue.prototype.push = function (item) {
    this.items.push(item);
};

TaskQueue.prototype.clear = function () {
    this.items.length = 0;
};

/**
 * @param {(item: string) => Promise<void>} worker
 */
TaskQueue.prototype.drain = async function (worker) {
    const workerCount = Math.max(1, this.concurrency);
    const runners = Array.from({ length: workerCount }, async () => {
        /**
         * @type {string|undefined}
         */
        let item;
        while ((item = this.items.shift()) !== undefined) {
            await worker(item);
        }
    });
    await Promise.all(runners);
};
