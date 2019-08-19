const process = require('process')
const os = require('os')
const child_process = require('child_process')
const EventEmitter = require('events')
const utils = require('./utils')
const ParallelTaskRunner = require('./ParallelTaskRunner')

class TaskRunner extends EventEmitter {
  constructor(binary, gtest_filter, options) {
    super()
    this.binary = binary
    this.gtest_filter = gtest_filter
    this.options = options
    this.test_list = []
    this.tasks = {}
    this.pending_completed_tasks = []
    this.is_killed = false
    this.results = []
    new utils.TestListHistory(binary, gtest_filter,
      (tests) => this.start_initial_tests(tests),
      (tests) => this.start_full_corrected_tests(tests))
  }
  start_initial_tests(tests) {
    if (this.is_killed)
      return
    if (!tests || !tests.length)
      return
    this.test_list = tests
    this.emit('testlist', tests)
    this.start_tests(tests)
  }
  start_full_corrected_tests(tests) {
    if (this.is_killed)
      return
    if (!tests || !tests.length) {
      this.emit('testlist', [])
      this.on_tests_finish()
      return
    }
    for (let t of this.pending_completed_tasks) {
      this.on_test_result(t)
    }
    this.pending_completed_tasks = undefined

    const [added_tests, removed_tests] = utils.getSetDifference(this.test_list, tests)
    if (!added_tests.length && !removed_tests.length) {
      return
    }
    this.test_list = tests
    this.emit('testlist', tests)
    for (let t of removed_tests) {
      // TODO(rajendrant): Remove and kill the tasks for removed tests.
      // if (this.tasks[t]) {
      //   this.tasks[t].kill()
      //   this.tasks[t] = undefined
      // }
    }
    this.start_tests(added_tests)
  }
  start_tests(tests) {
    if (this.is_killed)
      return
    const max=os.cpus().length
    ParallelTaskRunner.setMaximumParallelTask(max)
    const tests_per_run = Math.ceil(tests.length/max)
    for (let i=0; i<tests.length; i+=tests_per_run) {
      this.start_test_task(tests.slice(i, i+tests_per_run))
    }
  }
  start_test_task(tests) {
    this.tasks[tests] = new utils.TestTask(this.binary, tests, this.options, (task) => {
      if (this.is_killed)
        return
      if (task.error && Array.isArray(task.tests) && task.tests.length > 1) {
        for(let t of task.tests) {
          this.start_tests([t])
        }
        delete this.tasks[task.tests]
        return
      }
      if (Array.isArray(this.pending_completed_tasks)) {
        this.pending_completed_tasks.push(task)
      } else {
        this.on_test_result(task)
      }
    })
  }
  on_test_result(t) {
    delete this.tasks[t.tests]
    this.results.push(t)
    this.emit('result', t)
    if (Object.keys(this.tasks).length == 0) {
      this.on_tests_finish()
    }
  }
  on_tests_finish() {
    const failed = this.results.filter(t => t.error)
    const passed = this.results.filter(t => !t.error)
    this.emit('finish', passed, failed)
  }

  // External API.
  kill() {
    this.is_killed = true
    if (Object.keys(this.tasks).length != 0) {
      for(let t in this.tasks) {
        t.kill()
      }
      this.tasks = {}
      this.on_tests_finish()
    }
  }
}

module.exports = {
  runGtests: (binary, gtest_filter, options) => {
    return new TaskRunner(binary, gtest_filter, options)
  }
}
