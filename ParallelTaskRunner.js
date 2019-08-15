const os = require('os')

class ParallelTaskRunner {
  constructor() {
    this.waiting_tasks = []
    this.running_task_count = 0
  }

  enqueue(task) {
    this.waiting_tasks.push(task)
    this.try_task()
  }

  try_task() {
    if (this.running_task_count>=ParallelTaskRunner.MaximumParallelTasks ||
        !this.waiting_tasks.length)
      return
    this.running_task_count += 1
    let task = this.waiting_tasks.pop()
    task(() => {
      this.task_finished()
    })
  }

  task_finished() {
    this.running_task_count -= 1
    this.try_task()
  }
}

ParallelTaskRunner.MaximumParallelTasks = os.cpus().length
task_runner = new ParallelTaskRunner()

module.exports = {
  enqueue: (task) => {
    task_runner.enqueue(task)
  },
  setMaximumParallelTask: (count) => ParallelTaskRunner.MaximumParallelTasks = count
}
