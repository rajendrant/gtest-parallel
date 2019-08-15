const process = require('process')
const os = require('os')
const child_process = require('child_process')
const utils = require('./utils')
const ParallelTaskRunner = require('./ParallelTaskRunner')

class TaskRunner {
  constructor(binary, gtest_filter, args, outputter) {
    this.binary = binary
    this.gtest_filter = gtest_filter
    this.args = args
    this.outputter = outputter
    this.tasks = {}
    this.pending_completed_tasks = []
    new utils.TestListHistory(binary, gtest_filter,
      (tests) => this.start_initial_tests(tests),
      (tests) => this.start_full_corrected_tests(tests))
  }
  start_initial_tests(tests) {
    this.test_list = tests
    console.log('start_initial_tests', tests.length)
    this.start_tests(tests)
  }
  start_full_corrected_tests(tests) {
    if (!tests || !tests.length) return
    console.log('start_full_corrected_tests', tests.length)
    const test_list_set = new Set(this.test_list)
    const tests_set = new Set(tests)
    const more_tests = tests.filter(x => !test_list_set.has(x))
    const removed_tests = this.test_list.filter(x => !tests_set.has(x))
    this.test_list = tests
    for (let t of removed_tests) {
      // TODO(rajendrant): Remove and kill the tasks for removed tests.
      // if (this.tasks[t]) {
      //   this.tasks[t].kill()
      //   this.tasks[t] = undefined
      // }
    }
    for (let t of this.pending_completed_tasks) {
      this.outputter(t)
    }
    this.pending_completed_tasks = undefined
    this.start_tests(more_tests)
  }
  start_tests(tests) {
    const max=os.cpus().length
    ParallelTaskRunner.setMaximumParallelTask(max)
    const tests_per_run = Math.ceil(tests.length/max)
    for (let i=0; i<tests.length; i+=tests_per_run) {
      this.start_test_task(tests.slice(i, i+tests_per_run))
    }
  }
  start_test_task(tests) {
    this.tasks[tests] = new utils.TestTask(this.binary, tests, this.args, (task) => {
      // if (task.error && Array.isArray(task.tests) && task.tests.length > 1) {
      //   for(let t of task.tests) {
      //     this.start_tests([t])
      //   }
      //   return
      // }
      if (Array.isArray(this.pending_completed_tasks)) {
        this.pending_completed_tasks.push(task)
      } else {
        this.outputter(task)
      }
    })
  }
}

module.exports = {
  runGtests: (binary, gtest_filter, args, outputter) => {
    new TaskRunner(binary, gtest_filter, args, outputter)
  }
}
