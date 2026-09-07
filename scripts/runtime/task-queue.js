// Concurrency-limited task queue: N workers pull the next item as soon as
// they're free, instead of waiting for a whole batch to settle before
// starting newly-pushed items. A real reusable data structure (unlike the
// page-level loader/sandbox singletons), so it gets the same
// constructor+prototype shape as the parser.
export default function TaskQueue(concurrency) {
    this.concurrency = concurrency;
    this.items = [];
}

TaskQueue.prototype.setConcurrency = function(concurrency) {
    this.concurrency = concurrency;
};

TaskQueue.prototype.push = function(item) {
    this.items.push(item);
};

TaskQueue.prototype.clear = function() {
    this.items.length = 0;
};

TaskQueue.prototype.drain = async function(worker) {
    const workerCount = Math.max(1, this.concurrency);
    const runners = Array.from({ length: workerCount }, async () => {
        let item;
        while ((item = this.items.shift()) !== undefined) {
            await worker(item);
        }
    });
    await Promise.all(runners);
};
