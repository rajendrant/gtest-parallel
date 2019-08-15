const os = require('os')
const fs = require('fs')
const path = require('path')
const child_process = require('child_process')
const ParallelTaskRunner = require('./ParallelTaskRunner')

class TestTask {
  constructor(binary, tests, argument, callback) {
    this.tests = tests
    const testname = Array.isArray(tests) ? tests.join(':') : tests
    let arg = [`--gtest_filter=${testname}`]
    if (Array.isArray(argument))
      arg += argument
    ParallelTaskRunner.enqueue((resolve) => {
      this.proc = child_process.execFile(binary, arg, (error, stdout, stderr) => {
        this.error = error
        this.stdout = stdout
        this.stderr = stderr
        this.is_complete = true
        callback(this)
        resolve()
      })
    })
  }
  kill() {
    if (this.proc) {
      this.proc.kill()
      this.proc = undefined
    }
  }
}

class TestListHistory {
  constructor(binary, filter, on_initial_test_list, on_full_test_list) {
    this.binary = binary
    this.filter = filter
    this.tmp_file = path.join(os.tmpdir(), `gtest-parallel-${path.basename(this.binary)}.json`)
    this._find_full_tests(on_full_test_list)
    this._get_all_tests_from_history((tests) => {
      const res = tests[filter] ? tests[filter]['test_list'] : []
      on_initial_test_list(res)
    })
  }
  _get_all_tests_from_history(callback) {
    fs.readFile(this.tmp_file, (err, data) => {
      if (err)
        return callback({})
      try {
        callback(JSON.parse(data))
      } catch(e) {
        console.log(e)
        callback({})
      }
    })
  }
  _find_full_tests (on_full_test_list) {
    let arg = ['--gtest_list_tests']
    if (this.filter) {
      arg.push(`--gtest_filter=${this.filter}`)
    }
    child_process.execFile(this.binary, arg, (error, stdout, stderr) => {
      let tests = new Set()
      let test_group = ''
      for (let t of stdout.split('\n')) {
        t = t.split('#')[0]
        if(!t.trim()) continue
        if (t.charAt(0)!=' ') {
          test_group = t.trim()
        } else {
          tests.add(test_group + t.trim())
        }
      }
      tests = Array.from(tests)
      on_full_test_list(tests)
      this._save_full_tests(tests)
    })
  }
  _save_full_tests(new_test_list) {
    this._get_all_tests_from_history((tests) => {
      if (!tests)
        tests = {}
      if (!tests[this.filter])
        tests[this.filter] = {}
      let f = tests[this.filter]
      if (!f['usage'] || !Array.isArray(f['test_list'])) {
        f['usage'] = 0
      }
      f['usage']++
      f['test_list'] = new_test_list
      if (Object.keys(tests).length > 10) {
        // TODO(rajendrant): Remove entries with low |usage|
      }
      fs.writeFile(this.tmp_file, JSON.stringify(tests), (err) => {})
    })
  }

}

module.exports = {
  TestListHistory: TestListHistory,
  TestTask: TestTask,
}
